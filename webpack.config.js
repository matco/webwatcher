import path from 'path';
import {fileURLToPath} from 'url';
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
		clean: true
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: './index.html',
			inject: 'head',
			xhtml: true,
			favicon: './favicon.svg'
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
					'file-loader'
				]
			}
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
