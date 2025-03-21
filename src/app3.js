const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const port = 1433;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());

// Configura la conexión a PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'prueba',
    password: 'abc123',
    port: 5432,
});
app.use(cors());
app.use(express.json());

pool.connect()
    .then(() => console.log("✅ Conectado a PostgreSQL"))
    .catch(err => console.error("❌ Error conectando a PostgreSQL:", err));

// Endpoint para obtener los polígonos
app.get("/poligonos", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, nombre, ST_AsGeoJSON(poligono) AS geojson FROM poligonos"
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener los polígonos" });
    }
});

// Endpoint para obtener los puntos
app.get('/puntos', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, latitud, longitud FROM coordenadas');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener los puntos');
    }
});

app.post('/zona_aldama_sector1', async (req, res) => {
    const { opcionmenu } = req.body;

    if (!opcionmenu) {
        return res.status(400).json({ error: "Falta el parámetro opcionmenu" });
    }

    try {
        const query = `SELECT id, nombre, latitud, longitud FROM ${opcionmenu};`;
        //console.log("📌 Ejecutando consulta:", query); // Depuración
        const result = await pool.query(query);

        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error al obtener los datos:", err);
        res.status(500).json({ error: "Error al obtener los puntos" });
    }
});

app.post("/mover_dato", async (req, res) => {
    //console.log("📨 Datos recibidos:", req.body);
    const { id, destino, origen } = req.body;

    if (!id || !destino || !origen) {
        return res.status(400).json({ error: "⚠️ Faltan datos en la solicitud" });
    }

    try {
        // 1. Obtener el dato antes de moverlo
        const { rows } = await pool.query(`SELECT * FROM ${origen} WHERE id = $1`, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "❌ No se encontró el dato a mover" });
        }

        const datoMovido = rows[0]; // Guardar el dato para mostrarlo después

        // 2. Mover el dato de la tabla origen a la tabla destino
        await pool.query(`INSERT INTO ${destino} SELECT * FROM ${origen} WHERE id = $1`, [id]);

        // 3. Borrar el dato de la tabla origen
        await pool.query(`DELETE FROM ${origen} WHERE id = $1`, [id]);

        console.log(`✅ Dato con ID ${id} movido de la tabla '${origen}' a la tabla '${destino}'`);
        console.log("📋 Contenido del dato movido:", datoMovido);

        res.json({ 
            message: "✅ Dato movido correctamente", 
            contenido: datoMovido 
        });
    } catch (error) {
        console.error("❌ Error moviendo el dato:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});


// Ruta para agregar un nuevo registro
app.post("/agregar_registro", async (req, res) => {
    const { id, nombre, latitud, longitud, opcionmenu } = req.body;

    if (!opcionmenu) {
        return res.status(400).json({ error: "Falta la tabla de destino (opcionmenu)." });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(opcionmenu)) {
        return res.status(400).json({ error: "Nombre de tabla no válido." });
    }

    const query = `INSERT INTO ${opcionmenu} (id, nombre, latitud, longitud) VALUES ($1, $2, $3, $4)`;

    try {
        await pool.query(query, [id, nombre, latitud, longitud]);

        // Mostrar en consola el contenido del registro agregado
        console.log(`✅ Registro agregado en la tabla '${opcionmenu}':`, {
            id,
            nombre,
            latitud,
            longitud
        });

        res.json({ message: "✅ Registro agregado correctamente." });
    } catch (error) {
        console.error("❌ Error al agregar registro:", error);
        res.status(500).json({ error: "❌ Error al agregar el registro." });
    }
});


// Ruta para editar un registro existente
app.put("/editar_registro", async (req, res) => {
    const { id, nombre, latitud, longitud, opcionmenu } = req.body;

    if (!opcionmenu) {
        return res.status(400).json({ error: "Falta la tabla de destino (opcionmenu)." });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(opcionmenu)) {
        return res.status(400).json({ error: "Nombre de tabla no válido." });
    }

    const querySelect = `SELECT * FROM ${opcionmenu} WHERE id = $1`;
    const queryUpdate = `UPDATE ${opcionmenu} SET nombre = $2, latitud = $3, longitud = $4 WHERE id = $1`;

    try {
        // Obtener el registro antes de la actualización
        const { rows: previousRecord } = await pool.query(querySelect, [id]);

        if (previousRecord.length === 0) {
            return res.status(404).json({ error: "❌ No se encontró el registro con ese ID." });
        }

        // Actualizar el registro
        await pool.query(queryUpdate, [id, nombre, latitud, longitud]);

        // Mostrar en consola el registro anterior y el actualizado
        console.log(`✅ Registro actualizado en la tabla '${opcionmenu}' con ID ${id}:`);
        console.log("🔄 Antes de la actualización:", previousRecord[0]);
        console.log("➡️ Después de la actualización:", { id, nombre, latitud, longitud });

        res.json({ message: "✅ Registro actualizado correctamente." });
    } catch (error) {
        console.error("❌ Error al actualizar registro:", error);
        res.status(500).json({ error: "Error al actualizar el registro." });
    }
});

// Ruta para eliminar un registro
app.delete("/eliminar_registro", async (req, res) => {
    const { id, opcionmenu } = req.body;

    if (!opcionmenu) {
        return res.status(400).json({ error: "Falta la tabla de destino (opcionmenu)." });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(opcionmenu)) {
        return res.status(400).json({ error: "Nombre de tabla no válido." });
    }

    const querySelect = `SELECT * FROM ${opcionmenu} WHERE id = $1`;
    const queryDelete = `DELETE FROM ${opcionmenu} WHERE id = $1`;

    try {
        // Obtener el registro antes de eliminarlo
        const { rows: recordToDelete } = await pool.query(querySelect, [id]);

        if (recordToDelete.length === 0) {
            return res.status(404).json({ error: "❌ Registro no encontrado." });
        }

        // Eliminar el registro
        await pool.query(queryDelete, [id]);

        // Mostrar en consola el registro eliminado
        console.log(`✅ Registro eliminado de la tabla '${opcionmenu}' con ID ${id}:`, recordToDelete[0]);

        res.json({ message: "✅ Registro eliminado correctamente." });
    } catch (error) {
        console.error("❌ Error al eliminar registro:", error);
        res.status(500).json({ error: "❌ Error al eliminar el registro." });
    }
});


/*
// Ruta para agregar un nuevo registro
app.post("/agregar_registro", async (req, res) => {
    const { id, nombre, latitud, longitud, opcionmenu } = req.body;

    if (!opcionmenu) {
        return res.status(400).json({ error: "Falta la tabla de destino (opcionmenu)." });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(opcionmenu)) {
        return res.status(400).json({ error: "Nombre de tabla no válido." });
    }

    const query = `INSERT INTO ${opcionmenu} (id, nombre, latitud, longitud) VALUES ($1, $2, $3, $4)`;

    try {
        await pool.query(query, [id, nombre, latitud, longitud]);
        res.json({ message: "Registro agregado correctamente." });
    } catch (error) {
        console.error("Error al agregar registro:", error);
        res.status(500).json({ error: "Error al agregar el registro." });
    }
});*/
// Ruta para login
app.post("/login", async (req, res) => {
    const { usuario, password } = req.body;

    // Verifica las credenciales en PostgreSQL
    const query = 'SELECT * FROM usuarios WHERE usuario = $1 AND password = $2';
    try {
        const result = await pool.query(query, [usuario, password]);

        if (result.rows.length > 0) {
            return res.json({ success: true });
        } else {
            return res.json({ success: false, message: "Credenciales incorrectas." });
        }
    } catch (err) {
        console.error("Error en la consulta a la base de datos:", err);
        return res.status(500).json({ success: false, message: "Error en el servidor." });
    }
});


app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});