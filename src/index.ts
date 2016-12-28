import * as d3Selection from "d3-selection";
import * as d3Shape from "d3-shape";
import * as d3Request from "d3-request";
import * as d3Transition from "d3-transition";
import Graph, {
    Edge,
    EdgePoint,
    Location,
    Node,
    Path,
    SimpleEdge,
    SimpleNode,
} from "graphs-and-paths";
const d3 = { ...d3Selection, ...d3Request, ...d3Shape, ...d3Transition };

const DATA_JSON_FILE = "data/twin_peaks_2_mile.json";

// Should be kept up to date with index.css.
const SVG_WIDTH = 960;
const SVG_HEIGHT = 500;

main();

function main(): void {
    interface GraphData {
        nodes: SimpleNode[];
        edges: SimpleEdge[];
    }

    d3.json(DATA_JSON_FILE, (error, data: GraphData) => {
        const svgElement = document.getElementById("demo");
        if (!svgElement) {
            throw new Error("Demo element not found");
        }
        const { nodes, edges } = data;
        const graph = Graph.create(nodes, edges).withClosestPointMesh(25);
        const { graphToSvg, svgToGraph } = makeCoordinateConversionFunctions(graph);
        runDemo(svgElement, graph, svgToGraph, graphToSvg);
    });
}

function makeCoordinateConversionFunctions(graph: Graph) {
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

function runDemo(
    svgElement: HTMLElement,
    graph: Graph,
    svgToGraph: (location: Location) => Location,
    graphToSvg: (location: Location) => Location,
) {
    let activePathStart: EdgePoint | null = null;
    let closestPoint: EdgePoint | null = null;

    renderInitialElements();
    update();
    setUpMouseListeners();

    function renderInitialElements(): void {
        renderGraph();
        appendClosestPointHighlight();
        appendActivePath();
    }

    function renderGraph(): void {
        const edgeSelection = d3.select(svgElement).selectAll(".edge")
            .data(graph.getAllEdges());
        edgeSelection.enter().append("path")
            .classed("edge", true)
            .attr("stroke", "#5C7080")
            .attr("stroke-width", 3)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("fill", "none")
            .merge(edgeSelection)
            .attr("d", (edge) =>
                d3.line<Location>()
                    .x((location) => location.x)
                    .y((location) => location.y)(edge.locations.map(graphToSvg)));
        edgeSelection.exit().remove();
    }

    function appendClosestPointHighlight(): void {
        d3.select(svgElement).append("circle")
            .classed("closest-point-highlight", true)
            .attr("r", 10)
            .attr("fill", "#48AFF0")
            .attr("opacity", 0.75);
    }

    function appendActivePath(): void {
        d3.select(svgElement).append("path")
            .classed("active-path", true)
            .attr("stroke", "blue")
            .attr("stroke-width", 5)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("fill", "none");
    }

    function update(): void {
        updateClosestPointHighlight();
        updateActivePath();
    }

    function updateClosestPointHighlight(): void {
        const highlight = d3.select(svgElement).select(".closest-point-highlight")
            .attr("visibility", location ? "visible" : "hidden");
        if (closestPoint) {
            const svgLocation = graphToSvg(graph.getLocation(closestPoint));
            highlight
                .attr("cx", svgLocation.x)
                .attr("cy", svgLocation.y);
        }
    }

    function updateActivePath(): void {
        const activePath = d3.select(svgElement).select(".active-path");
        if (activePathStart && closestPoint) {
            const { orientedEdges } = graph.getShortestPath(activePathStart, closestPoint);
            // TODO: finish this
        }
    }

    function setUpMouseListeners(): void {
        svgElement.onmousedown = (event) => {
            activePathStart = closestPointForEvent(event);
            update();
        }
        svgElement.onmousemove = (event) => {
            closestPoint = closestPointForEvent(event);
            update();
        }
        svgElement.onmouseup = (event) => {
            activePathStart = null;
            update();
        }
        svgElement.onmouseleave = (event) => {
            activePathStart = null;
            closestPoint = null;
            update();
        }
    }

    function closestPointForEvent(event: MouseEvent): EdgePoint {
        const { clientX, clientY } = event;
        const { left, top } = svgElement.getBoundingClientRect();
        const svgLocation: Location = {
            x: clientX - left | 0,
            y: clientY - top | 0,
        };
        const graphLocation = svgToGraph(svgLocation);
        return graph.getClosestPoint(graphLocation);
    }
}
