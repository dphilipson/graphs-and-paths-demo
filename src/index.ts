import { ResizeSensor } from "css-element-queries";
import * as d3Request from "d3-request";
import * as d3Selection from "d3-selection";
import * as d3Shape from "d3-shape";
import Graph, {
    EdgePoint,
    Location,
    Path,
    SimpleEdge,
    SimpleNode,
} from "graphs-and-paths";
import "pepjs";

const d3 = { ...d3Selection, ...d3Request, ...d3Shape };

interface Dimensions {
    width: number;
    height: number;
}

const pathGenerator = d3.line<Location>()
    .x((location) => location.x)
    .y((location) => location.y);

(window as any).demo = demo;

function demo(selector: string, dataJsonFile: string): void {
    interface GraphData {
        nodes: SimpleNode[];
        edges: SimpleEdge[];
    }

    d3.json(dataJsonFile, (error, data: GraphData) => {
        if (error) {
            throw error;
        }
        const svgElement = d3.select(selector).append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("touch-action", "none")
            .node() as HTMLElement;
        const { nodes, edges } = data;
        const graph = Graph.create(nodes, edges).withClosestPointMesh(25);
        const graphDimensions = getGraphDimensions(graph);
        runDemo(svgElement, graph, graphDimensions);
    });
}

function getGraphDimensions(graph: Graph): Dimensions {
    const nodes = graph.getAllNodes();
    return {
        width: getSpan(nodes.map((node) => node.location.x)),
        height: getSpan(nodes.map((node) => node.location.y)),
    };
}

function getSpan(xs: number[]): number {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    xs.forEach((x) => {
        min = Math.min(min, x);
        max = Math.max(max, x);
    });
    return max - min;
}

function runDemo(
    svgElement: HTMLElement,
    graph: Graph,
    graphDimensions: Dimensions,
) {
    let activePathStart: EdgePoint | null = null;
    let closestPoint: EdgePoint | null = null;
    let exitingPaths: Path[] = [];
    let {
        svgToGraph,
        graphToSvg,
    } = getConversionFunctions();

    createSvgElements();
    setUpMouseListeners();
    setUpResizeListener();
    startAnimationTicks();

    function getConversionFunctions() {
        const { width: graphWidth, height: graphHeight } = graphDimensions;
        const { clientWidth: svgWidth, clientHeight: svgHeight } = svgElement;
        const graphAspectRatio = graphWidth / graphHeight;
        const svgAspectRatio = svgWidth / svgHeight;
        const graphToSvgRatio = graphAspectRatio > svgAspectRatio
            ? graphHeight / svgHeight
            : graphWidth / svgWidth;
        const svgCenter = { x: svgWidth / 2, y: svgHeight / 2 };
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
                };
            },
        };
    }

    function createSvgElements(): void {
        createGraphElement();
        createActivePathStartElement();
        createClosestPointElement();
        createActivePathElement();
    }

    function createGraphElement(): void {
        d3.select(svgElement).append("g")
            .classed("graph-group", true);
        updateGraphElement();
    }

    function updateGraphElement(): void {
        const edges = d3.select(".graph-group").selectAll(".edge")
            .data(graph.getAllEdges());
        edges.enter().append("path")
            .classed("edge", true)
            .attr("stroke", "#5C7080")
            .attr("stroke-width", 3)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("fill", "none")
            .merge(edges)
            .attr("d", (edge) => pathGenerator(edge.locations.map(graphToSvg)));
        edges.exit().remove();
    }

    function createActivePathStartElement(): void {
        d3.select(svgElement).append("circle")
            .classed("active-path-start-highlight", true)
            .attr("r", 10)
            .attr("fill", "#D9822B")
            .attr("opacity", 0.75);
        updateActivePathStartElement();
    }

    function updateActivePathStartElement(): void {
        const activePathStartElement = d3.select(".active-path-start-highlight");
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

    function createClosestPointElement(): void {
        d3.select(svgElement).append("circle")
            .classed("closest-point-highlight", true)
            .attr("r", 10)
            .attr("fill", "#FFB366")
            .attr("opacity", 0.75);
        updateClosestPointElement();
    }

    function updateClosestPointElement(): void {
        const closestPointElement = d3.select(".closest-point-highlight");
        closestPointElement
            .attr("visibility", closestPoint ? "visible" : "hidden");
        if (closestPoint) {
            const {x, y} = graphToSvg(graph.getLocation(closestPoint));
            closestPointElement
                .attr("cx", x)
                .attr("cy", y);
        }
    }

    function createActivePathElement(): void {
        d3.select(svgElement).append("path")
            .classed("active-path", true)
            .attr("stroke", "#D9822B")
            .attr("stroke-width", 6)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("fill", "none")
            .attr("opacity", 0.5);
        updateActivePathElement();
    }

    function updateActivePathElement(): void {
        const activePathElement = d3.select(".active-path");
        if (activePathStart && closestPoint) {
            const { locations } = graph.getShortestPath(activePathStart, closestPoint);
            activePathElement
                .attr("visibility", "visible")
                .attr("d", pathGenerator(locations.map(graphToSvg)) as string);
        } else {
            activePathElement
                .attr("visibility", "hidden")
                .attr("d", "");
        }
    }

    function updateExitingPaths(): void {
        const pathGroups = d3.select(svgElement).selectAll(".exiting-path-group")
            .attr("visibility", "visible")
            .data(exitingPaths);
        const enteringPathGroups = pathGroups.enter().append("g")
            .classed("exiting-path-group", true);
        // Path
        enteringPathGroups.append("path")
            .classed("exiting-path", true)
            .attr("stroke", "#D9822B")
            .attr("stroke-width", 6)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("fill", "none");
        pathGroups.select(".exiting-path")
            .attr("d", (path) => pathGenerator(path.locations.map(graphToSvg)));
        // Start highlight
        enteringPathGroups.append("circle")
            .classed("exiting-path-start", true)
            .attr("r", 10)
            .attr("fill", "#D9822B")
            .attr("opacity", 0.75)
            .merge(pathGroups.select(".exiting-path-start"))
            .datum((path) => graphToSvg(path.locations[0]))
            .attr("cx", (location) => location.x)
            .attr("cy", (location) => location.y);
        // End highlight
        enteringPathGroups.append("circle")
            .classed("exiting-path-end", true)
            .attr("r", 10)
            .attr("fill", "#D9822B")
            .attr("opacity", 0.75)
            .merge(pathGroups.select(".exiting-path-end"))
            .datum((path) => graphToSvg(path.locations[path.locations.length - 1]))
            .attr("cx", (location) => location.x)
            .attr("cy", (location) => location.y);
        // Hide rather than remove finished paths to work around a pepjs bug if elements are
        // removed before pointerup triggers (see https://github.com/jquery/PEP/issues/326). Only
        // actually remove exited paths after a pointerup event.
        pathGroups.exit().attr("visibility", "hidden");
    }

    function flushRemovedExitingPaths(): void {
        // See above note in updateExistingPaths().
        d3.select(svgElement).selectAll(".exiting-path-group")
            .data(exitingPaths)
            .exit().remove();
    }

    function setUpMouseListeners(): void {
        svgElement.addEventListener("pointerdown", (event) => {
            activePathStart = closestPointForEvent(event);
            updateActivePathStartElement();
            updateActivePathElement();
        });
        svgElement.addEventListener("pointermove", (event) => {
            closestPoint = closestPointForEvent(event);
            updateClosestPointElement();
            updateActivePathElement();
        });
        svgElement.addEventListener("pointerup", () => {
            if (activePathStart && closestPoint) {
                exitingPaths.push(graph.getShortestPath(activePathStart, closestPoint));
            }
            activePathStart = null;
            updateActivePathStartElement();
            updateActivePathElement();
            updateExitingPaths();
            flushRemovedExitingPaths();
        });
        svgElement.addEventListener("pointerleave", () => {
            activePathStart = null;
            closestPoint = null;
            updateClosestPointElement();
            updateActivePathStartElement();
            updateActivePathElement();
        });
    }

    function closestPointForEvent(event: PointerEvent): EdgePoint {
        const { clientX, clientY } = event;
        const { left, top } = svgElement.getBoundingClientRect();
        const svgLocation: Location = {
            x: clientX - left | 0,
            y: clientY - top | 0,
        };
        const graphLocation = svgToGraph(svgLocation);
        return graph.getClosestPoint(graphLocation);
    }

    function setUpResizeListener(): void {
        // tslint:disable-next-line:no-unused-new
        new ResizeSensor(svgElement.parentElement, () => {
            const conversions = getConversionFunctions();
            svgToGraph = conversions.svgToGraph;
            graphToSvg = conversions.graphToSvg;
            updateGraphElement();
            updateClosestPointElement();
            updateActivePathStartElement();
            updateActivePathElement();
            updateExitingPaths();
        });
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
            const distanceGained = dTime * getPathExitSpeed();
            const newPaths: Path[] = [];
            exitingPaths.forEach((path) => {
                const newPath = graph.advanceAlongPath(path, distanceGained);
                if (newPath.length > 0) {
                    newPaths.push(newPath);
                }
            });
            exitingPaths = newPaths;
            updateExitingPaths();
        }
    }

    function getPathExitSpeed(): number {
        // A path crossing the whole viewport on the diagonal should take this much time to disapear.
        const diagonalExitTime = 10000;
        const { x, y } = svgToGraph({ x: 0, y: 0 });
        // Takes advantage of the fact that (0, 0) in graph coordinates is at the center of the svg.
        const diagonalLength = 2 * Math.sqrt(x * x + y * y);
        return diagonalLength / diagonalExitTime;
    }
}
