import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';

import { Header } from './components/Header.jsx';
import { Home } from './pages/Home/index.jsx';
import { NotFound } from './pages/_404.jsx';
import './style.css';

export const ROUTER_PREFIX = (new URL(import.meta.url.replace("src/", ""))).pathname.match(/.*\//)[0];
export function urlPath(path: string) {
	console.log(ROUTER_PREFIX, );
	return ROUTER_PREFIX + path.replace(/^\//, '');
}

export function App() {
	return (
		<LocationProvider>
			<Header />
			<main>
				<Router>
					<Route path={urlPath("/")} component={Home} />
					<Route default component={NotFound} />
				</Router>
			</main>
		</LocationProvider>
	);
}

render(<App />, document.getElementById('app'));
