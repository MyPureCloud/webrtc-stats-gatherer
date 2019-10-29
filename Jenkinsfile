@Library('pipeline-library@webapp-pipelines') _

webappPipeline {
    slaveLabel = 'dev'
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
            rollbackPlan: 'Patch version with fix'
        ]
    }

    shouldTagOnRelease = { true }
}
