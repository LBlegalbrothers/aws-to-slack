//
// AWS Elastic Beanstalk event parser
//
exports.matches = event =>
	// Will only match SNS messages
	_.startsWith(event.getSubject(), "AWS Elastic Beanstalk Notification");

exports.parse = event => {
	// Split the incoming message into individual fields for easier parsing
	const lines = _.split(event.message, "\n");
	const message = _.reduce(lines, (returnObj, line) => {
		if (!_.isEmpty(line) && _.includes(line, ":")) {
			const key = _.trim(line.substr(0, line.indexOf(":")));
			const value = _.trim(line.substr(key.length + 1));
			return _.extend(returnObj, { [key]: value });
		}
		return returnObj;
	}, {});

	if (!_.has(message, "Message") || !_.has(message, "Application") ||
		!_.has(message, "Environment") || !_.has(message, "Timestamp")) {
		// Doesn't seem like we can parse this - so not of interest for us
		return false;
	}

	// RDS Message
	const text = _.get(message, "Message");
	const application = _.get(message, "Application");
	const environment = _.get(message, "Environment");
	const environmentUrl = _.get(message, "Environment URL");

	const stateRed = (_.includes(text, " to RED"));
	const stateSevere = (_.includes(text, " to Severe"));
	const butWithErrors = (_.includes(text, " but with errors"));
	const noPermission = (_.includes(text, "You do not have permission"));
	const failedDeploy = (_.includes(text, "Failed to deploy application"));
	const failedConfig = (_.includes(text, "Failed to deploy configuration"));
	const failedQuota = (_.includes(text, "Your quota allows for 0 more running instance"));
	const unsuccessfulCommand = (_.includes(text, "Unsuccessful command execution"));

	const stateYellow = (_.includes(text, " to YELLOW"));
	const stateWarning = (_.includes(text, " to Warning"));
	const stateDegraded = (_.includes(text, " to Degraded"));
	const stateInfo = (_.includes(text, " to Info"));
	const removedInstance = (_.includes(text, "Removed instance "));
	const addingInstance = (_.includes(text, "Adding instance "));
	const abortedOperation = (_.includes(text, " aborted operation."));
	const abortedDeployment = (_.includes(text, "some instances may have deployed the new application version"));

	let color = event.COLORS.ok;
	if (stateRed || stateSevere || butWithErrors || noPermission ||
		failedDeploy || failedConfig || failedQuota || unsuccessfulCommand) {
		color = event.COLORS.critical;
	}
	if (stateYellow || stateWarning || stateDegraded || stateInfo ||
		removedInstance || addingInstance || abortedOperation ||
		abortedDeployment) {
		color = event.COLORS.warning;
	}

	if ('New application version was deployed' in text){
		// 새 인스턴스 배포는 알림 제외
		return false;
	}
	if (color!=event.COLORS.critical){
		// critial 알림만 푸시
		return false
	}

	return event.attachmentWithDefaults({
		fallback: `${application} / ${environment}: ${text}`,
		color: color,
		author_name: "AWS Elastic Beanstalk",
		title: `${application} / ${environment}`,
		title_link: environmentUrl,
		text: text,
		fields: [{
			title: "Application",
			value: application,
			short: true
		}, {
			title: "Environment",
			value: environment,
			short: true
		}],
	});
};
