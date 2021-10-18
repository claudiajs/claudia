module.exports = function findCloudfrontBehavior(config, pathPattern) {
	'use strict';
	if (!pathPattern || pathPattern === '*') {
		return config.DefaultCacheBehavior;
	}
	return config.CacheBehaviors && config.CacheBehaviors.Items && config.CacheBehaviors.Items.find(beh => beh.PathPattern === pathPattern);
};

