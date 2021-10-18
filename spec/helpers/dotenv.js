const fs = require('fs');
if (fs.existsSync('.env')) {
	require('dotenv').load();
}
