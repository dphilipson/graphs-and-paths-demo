import * as d3Selection from "d3-selection";
import * as d3Shape from "d3-shape";
import * as d3Request from "d3-request";
import * as d3Transition from "d3-transition";
import Graph, {
    Edge,
    Location,
    Node,
    Path,
    SimpleEdge,
    SimpleNode,
} from "graphs-and-paths";

const d3 = { ...d3Selection, ...d3Request, ...d3Shape, ...d3Transition };

interface GraphData {
    nodes: SimpleNode[];
    edges: SimpleEdge[];
}

// Should be kept up to date with index.css.
const SVG_WIDTH = 960;
const SVG_HEIGHT = 500;

const svg = d3.select("#demo");

d3.json("data/twin_peaks_1_mile.json", (error, data: GraphData) => {
    const { nodes, edges } = data;
    const graph = Graph.create(nodes, edges).withClosestPointMesh(25);
    renderGraph(graph);
});

function renderGraph(graph: Graph): void {
    const graphToSvgCoordinates = makeGraphToSvgCoordinates(graph);
    const circle = svg.selectAll("circle")
        .data(graph.getAllNodes());
    circle.enter().append("circle")
        .attr("r", 2.5)
        .merge(circle)
        .attr("cx", (node) => graphToSvgCoordinates(node.location).x)
        .attr("cy", (node) => graphToSvgCoordinates(node.location).y);
    circle.exit().remove();

    const path = svg.selectAll("path")
        .data(graph.getAllEdges());
    path.enter().append("path")
        .attr("stroke", "black")
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("fill", "none")
        .merge(path)
        .attr("d", (edge) =>
            d3.line<Location>()
                .x((location) => location.x)
                .y((location) => location.y)(edge.locations.map(graphToSvgCoordinates)));
    path.exit().remove();
}



function makeGraphToSvgCoordinates(graph: Graph) {
    const minX = Math.min(...graph.getAllNodes().map((node) => node.location.x));
    const maxX = Math.max(...graph.getAllNodes().map((node) => node.location.x));
    const minY = Math.min(...graph.getAllNodes().map((node) => node.location.y));
    const maxY = Math.max(...graph.getAllNodes().map((node) => node.location.y));
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const graphAspectRatio = graphWidth / graphHeight;
    const svgAspectRatio = SVG_WIDTH / SVG_HEIGHT;
    const graphToSvgRatio = graphAspectRatio > svgAspectRatio
        ? graphHeight / SVG_HEIGHT
        : graphWidth / SVG_WIDTH;

    return (location: Location): Location => {
        const svgCenter = { x: SVG_WIDTH / 2, y: SVG_HEIGHT / 2 };
        return {
            x: svgCenter.x + location.x / graphToSvgRatio,
            y: svgCenter.y + location.y / graphToSvgRatio,
        };
    };
}
