const axios = require('axios');

async function checkDiagLogs() {
    try {
        console.log("Fetching live Render diagnostics logs...");
        const res = await axios.get('https://backend-kj17.onrender.com/api/diag-logs');
        console.log("=== Live Socket Connection & Authentication Logs ===");
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error("Error fetching logs:", err.message);
    }
}
checkDiagLogs();
