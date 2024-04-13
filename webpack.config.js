const path = require('path');

module.exports = {
    entry: {
      date_range: './js/barrelmodule.js',
    },
    output: {
        filename: 'barrel.js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            name: 'webpackExports',
            type: 'var'
        }
    },
    mode: 'development',
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', { targets: "defaults" }],
                            ["@babel/preset-react", {runtime: "automatic"}]
                        ]
                    }
                }
            },
            {
                test: /\.css$/i,
                use: ["style-loader","css-loader"],
            }
        ]
    }
};
