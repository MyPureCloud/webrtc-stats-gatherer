# Changelog
All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# [Unreleased](https://github.com/mypurecloud/webrtc-stats-gatherer/compare/v9.0.10...HEAD)
### Changed
* [STREAM-621](https://inindca.atlassian.net/browse/STREAM-621) - Remove pipeline infra, update CODEOWNERS.

# [v9.0.10](https://github.com/mypurecloud/webrtc-stats-gatherer/compare/v9.0.9...v9.0.10)
### Fixed
* [NO-JIRA] Use target of `es5` to avoid breaking consumers

# [v9.0.9](https://github.com/mypurecloud/webrtc-stats-gatherer/compare/v9.0.8...v9.0.9)
### Fixed
* [STREAM-69](https://inindca.atlassian.net/browse/STREAM-69) Return an empty array when gathering stats for other states like `disconnected` to prevent errors in callers when network connectivity drops

### Changed
* [STREAM-32](https://inindca.atlassian.net/browse/STREAM-32) Update dev dependencies, switch to ESLint, add Prettier

# [v9.0.8](https://github.com/mypurecloud/webrtc-stats-gatherer/compare/v9.0.6...v9.0.8)
### Fixed
* [PCM-2326](https://inindca.atlassian.net/browse/PCM-2326) - Stop stats gathering if the session ends in "fail" state

# [v9.0.6](https://github.com/mypurecloud/webrtc-stats-gatherer/compare/v9.0.5...v9.0.6)
### Fixed
* [PCM-2058](https://inindca.atlassian.net/browse/PCM-2058) - Fix issue with initial stats check generating an error

# [v9.0.5](https://github.com/mypurecloud/webrtc-stats-gatherer/compare/v9.0.4...v9.0.5)

### Fixed
* [PCM-1946](https://inindca.atlassian.net/browse/PCM-1946) - Fix issue with initial stats check generating an error

# [v9.0.4](https://github.com/mypurecloud/webrtc-stats-gatherer/compare/v9.0.3...v9.0.4)

### Fixed
* [PCM-1946](https://inindca.atlassian.net/browse/PCM-1946) - Fix the typo for calculating incoming tracks' packetloss
