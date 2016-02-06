/*global require */
if (require('shelljs').test('-e', '.env')) {
	require('dotenv').load();
}
