const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const WebpackNotifierPlugin = require('webpack-notifier');

const NODE_ENV = process.env.NODE_ENV || 'development';
const TEST_ENV = process.env.TEST_ENV || 'node';
const NPM_COMMAND = process.env.npm_lifecycle_event;
// tslint:disable:no-console
console.info(`
:--------- process.env.NODE_ENV: ${NODE_ENV} ---------:,
:--------- process.env.TEST_ENV: ${TEST_ENV} ---------:
`);

let config = {
    entry: {
        index: ['./src/index.ts']
    },
    output: {
        path: path.join(__dirname, 'public'),
        filename: '[name].bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            cacheDirectory: true
                        }
                    },
                    {
                        loader: 'awesome-typescript-loader',
                        // loader: 'ts-loader',
                        options: {
                            configFile: 'tsconfig.webpack.json'
                        }
                    }
                ]
            }
        ]
    },
    plugins: [
        new WebpackNotifierPlugin({ title: 'Webpack' }),
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(NODE_ENV),
                TEST_ENV: JSON.stringify(TEST_ENV)
            }
        })
    ],
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx']
    }
};

if (NPM_COMMAND === 'start' || NPM_COMMAND === 'server') {
    config = merge(config, {
        devtool: 'inline-source-map',
        output: {
            path: '/',
            filename: '[name].bundle.js'
        },
        devServer: {
            contentBase: 'public',
            inline: true,
            noInfo: true
        }
    });
}

module.exports = config;
