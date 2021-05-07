import path from 'path';
import {fileURLToPath} from 'url';
import {CleanWebpackPlugin} from 'clean-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
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
	},
	devServer: {
		proxy: {
			'/api': {
				target: 'http://localhost:1338'
			}
		}
	}
};
