const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
	mode: 'development',
	context: path.resolve(__dirname, 'src'),
	entry: {
		app: ['./js/index.js', './index.css']
	},
	output: {
		path: path.resolve(__dirname, 'static'),
		filename: '[name]-bundle-[fullhash].js'
	},
	plugins: [
		new CleanWebpackPlugin(),
		new HtmlWebpackPlugin({
			template: './index.html',
			inject: 'head',
			xhtml: true,
		})
	],
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [
					'style-loader',
					'css-loader'
				]
			},
			{
				test: /\.png$/,
				use: [
					'file-loader',
				]
			},
		]
	}
};
