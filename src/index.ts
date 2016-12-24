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

interface Conversions {
    graphToSvg: Conversion;
    svgToGraph: Conversion;
}

interface Conversion {
    (location: Location): Location;
}

// Should be kept up to date with index.css.
const SVG_WIDTH = 960;
const SVG_HEIGHT = 500;

const svgElement = document.getElementById("demo") as HTMLElement;
const svg = d3.select(svgElement);

d3.json("data/twin_peaks_1_mile.json", (error, data: GraphData) => {
    const { nodes, edges } = data;
    const graph = Graph.create(nodes, edges).withClosestPointMesh(25);
    const conversions = makeCoordinateConversionFunctions(graph);
    const { graphToSvg, svgToGraph } = conversions;
    renderGraph(graph, graphToSvg);
    setUpHoverListener(graph, conversions);
});

function renderGraph(graph: Graph, graphToSvg: Conversion): void {
    const circle = svg.selectAll(".node")
        .data(graph.getAllNodes());
    circle.enter().append("circle")
        .classed("node", true)
        .attr("r", 2.5)
        .merge(circle)
        .attr("cx", (node) => graphToSvg(node.location).x)
        .attr("cy", (node) => graphToSvg(node.location).y);
    circle.exit().remove();

    const path = svg.selectAll(".edge")
        .data(graph.getAllEdges());
    path.enter().append("path")
        .classed("edge", true)
        .attr("stroke", "black")
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("fill", "none")
        .merge(path)
        .attr("d", (edge) =>
            d3.line<Location>()
                .x((location) => location.x)
                .y((location) => location.y)(edge.locations.map(graphToSvg)));
    path.exit().remove();
}

function makeCoordinateConversionFunctions(graph: Graph): Conversions {
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
    const svgCenter = { x: SVG_WIDTH / 2, y: SVG_HEIGHT / 2 };
    return {
        graphToSvg(location: Location): Location {
            return {
                x: svgCenter.x + location.x / graphToSvgRatio,
                y: svgCenter.y + location.y / graphToSvgRatio,
            };
        },

        svgToGraph(location: Location): Location {
            return {
                x: (location.x - svgCenter.x) * graphToSvgRatio,
                y: (location.y - svgCenter.y) * graphToSvgRatio,
            }
        },
    };
}

function setUpHoverListener(graph: Graph, conversions: Conversions): void {
    const { graphToSvg, svgToGraph } = conversions;
    svg.append("circle")
        .classed("closest-point-highlight", true)
        .attr("r", 10)
        .attr("fill", "rgba(72, 176, 240, 0.75)");
    const updateClosestPointHighlight = (location: Location | null) => {
        const highlight = svg.select(".closest-point-highlight")
            .attr("visibility", location ? "visible" : "hidden");
        if (location) {
            const svgLocation = graphToSvg(location);
            highlight
                .attr("cx", svgLocation.x)
                .attr("cy", svgLocation.y);
        }
    }
    updateClosestPointHighlight(null);

    svgElement.onmousemove = (event) => {
        const { clientX, clientY } = event;
        const { left, top } = svgElement.getBoundingClientRect();
        const svgLocation: Location = {
            x: clientX - left | 0,
            y: clientY - top | 0,
        };
        const graphLocation = svgToGraph(svgLocation);
        const closestPoint = graph.getLocation(graph.getClosestPoint(graphLocation));
        updateClosestPointHighlight(closestPoint);
    };

    svgElement.onmouseleave = () => updateClosestPointHighlight(null);
}
