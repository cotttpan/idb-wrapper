const webpackConfig = require('./webpack.config');
module.exports = function (config) {
    config.set({

        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '',


        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha'],


        // list of files / patterns to load in the browser
        files: [
            { pattern: 'test/**/*.test.ts', watched: false }
        ],


        // list of files to exclude
        exclude: [],


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            'test/**/*.test.ts': ['webpack', 'sourcemap']
        },

        // webpack.config.jsから取ってきた場合、testに必要ないoptionで起動が重くなるため
        // ここにべた書きしている
        webpack: {
            devtool: 'inline-source-map',
            module: webpackConfig.module,
            plugins: webpackConfig.plugins,
            resolve: webpackConfig.resolve
        },

        webpackMiddleware: {
            // webpack-dev - middleware configuration
            // webpackのログを消す
            noInfo: true,
            quiet: true
        },

        // Redefine default mapping from file extensions to MIME-type
        // こいつが無いと.ts(.tsx)を読めない？？？
        mime: {
            'text/x-typescript': ['ts', 'tsx']
        },

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        // [karma-mocha-reporter](https://www.npmjs.com/package/karma-mocha-reporter)
        // [karma-notify-reporter](https://www.npmjs.com/package/karma-notify-reporter)
        reporters: ['nyan', 'notify'],

        nyanReporter: {
            // suppress the red background on errors in the error
            // report at the end of the test run
            suppressErrorHighlighting: true, // default is false

            // only render the graphic after all tests have finished.
            // This is ideal for using this reporter in a continuous
            // integration environment.
            renderOnRunCompleteOnly: true // default is false
        },

        // karma-notify-reporter settings
        notifyReporter: {
            reportEachFailure: true, // Default: false, Will notify on every failed sepc
            reportSuccess: false // Default: true, Will notify when a suite was successful
        },

        // web server port
        port: 9876,


        // enable / disable colors in the output (reporters and logs)
        colors: true,


        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_INFO,


        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['Chrome'], // 'jsdom 'or "Chrome"


        // enable / disable watching file and executing tests whenever any file changes
        // autoWatchまたはsingleRunのどちらかがtrueじゃないとtestが走らない
        // CLIから指定する
        // autoWatch: false,


        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        // singleRun: true,


        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: Infinity
    });
};
