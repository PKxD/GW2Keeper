import './style.css';
import WeaponAnalyzer from "../../components/WeaponAnalyzer"

export function Home() {
	return (
		<div class="home">
			<WeaponAnalyzer />
		</div>
	);
}

function Resource(props) {
	return (
		<a href={props.href} target="_blank" class="resource">
			<h2>{props.title}</h2>
			<p>{props.description}</p>
		</a>
	);
}
