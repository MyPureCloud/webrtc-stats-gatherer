@Library('pipeline-library@webapp-pipelines') _

webappPipeline {
    slaveLabel = 'dev_v2'
    nodeVersion = '10.16.2'
    useArtifactoryRepo = false
    projectName = 'webrtc-stats-gatherer'
    manifest = directoryManifest('dist')
    buildType = { (env.BRANCH_NAME == 'master' || env.BRANCH_NAME == 'release') ? 'MAINLINE' : 'FEATURE' }
    publishPackage = { 'prod' }
    testJob = 'valve-webrtc-stats-tests'

    buildStep = {
        sh('''
            npm i && npm test && npm run build
        ''')
    }

    cmConfig = {
        return [
            managerEmail: 'purecloud-client-media@genesys.com',
            rollbackPlan: 'Patch version with fix',
            testResults: 'https://jenkins.ininica.com/job/valve-webrtc-stats-tests-test/'
        ]
    }

    shouldTagOnRelease = { true }

    postReleaseStep = {
        sshagent(credentials: [constants.credentials.github.inin_dev_evangelists]) {
            sh("""
                git tag v${version}
                git push origin --tags
            """)
        }
    }
}
