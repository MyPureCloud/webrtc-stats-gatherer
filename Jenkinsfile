@Library('pipeline-library@webapp-pipelines') _

webappPipeline {
    slaveLabel = 'dev_v2'
    nodeVersion = '10.16.2'
    useArtifactoryRepo = false
    projectName = 'webrtc-stats-gatherer'
    manifest = directoryManifest('dist')
    buildType = { (env.BRANCH_NAME == 'master' || env.BRANCH_NAME == 'release') ? 'MAINLINE' : 'FEATURE' }
    publishPackage = { 'dev' }
    shouldDeployDev = { true }
    shouldDeployTest = { false }
    shouldTestProd = { false }

    buildStep = {
        sh('''
            npm i && npm test && npm run build
        ''')
    }

    upsertCMStep = {
        sh('''
            echo "no CM needed since this is not a standalone app"
        ''')
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
