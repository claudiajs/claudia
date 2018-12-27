module.exports = function combineLists(oldList, toAddCsv, toRemoveCsv) {
	'use strict';
	const existing = oldList || [],
		additional = (toAddCsv && toAddCsv.split(',')) || [],
		superfluous = (toRemoveCsv && toRemoveCsv.split(',')) || [];

	return existing.filter(f => !superfluous.includes(f)).concat(additional);
};

