import * as d3Selection from "d3-selection";
import * as d3Shape from "d3-shape";
import * as d3Request from "d3-request";
import Graph, {
    EdgePoint,
    Location,
    Path,
    SimpleEdge,
    SimpleNode,
} from "graphs-and-paths";
const d3 = { ...d3Selection, ...d3Request, ...d3Shape };

const DATA_JSON_FILE = "data/twin_peaks_2_mile.json";

// Should be kept up to date with index.css.
const SVG_WIDTH = 960;
const SVG_HEIGHT = 500;

const pathGenerator = d3.line<Location>()
    .x((location) => location.x)
    .y((location) => location.y);

main();

function main(): void {
    interface GraphData {
        nodes: SimpleNode[];
        edges: SimpleEdge[];
    }

    d3.json(DATA_JSON_FILE, (error, data: GraphData) => {
        if (error) {
            throw error;
        }
        const svgElement = document.getElementById("demo");
        if (!svgElement) {
            throw new Error("Demo element not found");
        }
        const { nodes, edges } = data;
        const graph = Graph.create(nodes, edges).withClosestPointMesh(25);
        const { graphToSvg, svgToGraph } = makeCoordinateConversionFunctions(graph);
        const pathExitSpeed = getPathExitSpeed(svgToGraph);
        runDemo(svgElement, graph, svgToGraph, graphToSvg, pathExitSpeed);
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

function getPathExitSpeed(svgToGraph: (location: Location) => Location) {
    // A path crossing the whole viewport on the diagonal should take this much time to disapear.
    const diagonalExitTime = 1000;
    const { x, y } = svgToGraph({ x: 0, y: 0 });
    // Takes advantage of the fact that (0, 0) in graph coordinates is at the center of the svg.
    const diagonalLength = 2 * Math.sqrt(x * x + y * y);
    return diagonalLength / diagonalExitTime;
}

function runDemo(
    svgElement: HTMLElement,
    graph: Graph,
    svgToGraph: (location: Location) => Location,
    graphToSvg: (location: Location) => Location,
    pathExitSpeed: number,
) {
    let activePathStart: EdgePoint | null = null;
    let closestPoint: EdgePoint | null = null;
    let exitingPaths: Path[] = [];

    renderGraph();

    let activePathStartElement = createActivePathStartElement();
    let closestPointElement = createClosestPointElement();
    let activePathElement = createActivePathElement();

    update();
    setUpMouseListeners();
    startAnimationTicks();

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
            .attr("d", (edge) => pathGenerator(edge.locations.map(graphToSvg)));
        edgeSelection.exit().remove();
    }

    function createActivePathStartElement() {
        return d3.select(svgElement).append("circle")
            .classed("active-path-start-highlight", true)
            .attr("r", 10)
            .attr("fill", "#D9822B")
            .attr("opacity", 0.75);
    }

    function createClosestPointElement() {
        return d3.select(svgElement).append("circle")
            .classed("closest-point-highlight", true)
            .attr("r", 10)
            .attr("fill", "#FFB366")
            .attr("opacity", 0.75);
    }

    function createActivePathElement() {
        return d3.select(svgElement).append("path")
            .classed("active-path", true)
            .attr("stroke", "#D9822B")
            .attr("stroke-width", 6)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("fill", "none");
    }

    function update(): void {
        updateClosestPointHighlight();
        updateActivePathHighlight();
        updateActivePath();
        updateExitingPaths();
    }

    function updateClosestPointHighlight(): void {
        closestPointElement
            .attr("visibility", closestPoint ? "visible" : "hidden");
        if (closestPoint) {
            const {x, y} = graphToSvg(graph.getLocation(closestPoint));
            closestPointElement
                .attr("cx", x)
                .attr("cy", y);
        }
    }

    function updateActivePathHighlight(): void {
        if (activePathStart) {
            const {x, y} = graphToSvg(graph.getLocation(activePathStart));
            activePathStartElement
                .attr("visibility", "visible")
                .attr("cx", x)
                .attr("cy", y);
        } else {
            activePathStartElement.attr("visibility", "hidden");
        }
    }

    function updateActivePath(): void {
        if (activePathStart && closestPoint) {
            const { locations } = graph.getShortestPath(activePathStart, closestPoint);
            activePathElement
                .attr("visibility", "visible")
                .attr("d", pathGenerator(locations.map(graphToSvg)) as string);
        } else {
            activePathElement.attr("visibility", "hidden");
        }
    }

    function updateExitingPaths(): void {
        const exitingPathSelection = d3.select(svgElement).selectAll(".exiting-path")
            .data(exitingPaths);
        exitingPathSelection.enter().append("path")
            .classed("exiting-path", true)
            .attr("stroke", "#D9822B")
            .attr("stroke-width", 6)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("fill", "none")
            .merge(exitingPathSelection)
            .attr("d", (path) => pathGenerator(path.locations.map(graphToSvg)));
        exitingPathSelection.exit().remove();
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
        svgElement.onmouseup = () => {
            if (activePathStart && closestPoint) {
                exitingPaths.push(graph.getShortestPath(activePathStart, closestPoint));
            }
            activePathStart = null;
            update();
        }
        svgElement.onmouseleave = () => {
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

    function startAnimationTicks(): void {
        startAnimationTicksFromTime(Date.now());
    }

    function startAnimationTicksFromTime(lastTime: number): void {
        window.requestAnimationFrame((time) => {
            advanceExitingPaths(time - lastTime);
            startAnimationTicksFromTime(time);
        });
    }

    function advanceExitingPaths(dTime: number): void {
        if (exitingPaths.length > 0) {
            const distanceGained = dTime * pathExitSpeed;
            const newPaths: Path[] = [];
            exitingPaths.forEach((path) => {
                const newPath = graph.advanceAlongPath(path, distanceGained);
                if (newPath.length > 0) {
                    newPaths.push(newPath);
                }
            });
            exitingPaths = newPaths;
            update();
        }
    }
}