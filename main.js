require("dotenv").config();

const minData = 5;
const redisKey = "stairwell";

//in ms
const maxInterval = 3000;
const minInterval = 1000;

const client = require("redis").createClient(); //database
const http = require("http");
const port = 3000;

http.createServer((req, res) => {
	const headers = {
		"Access-Control-Allow-Origin": "*" /* @dev First, read about security */,
		"Access-Control-Allow-Methods": "OPTIONS, POST, GET",
		"Access-Control-Max-Age": 2592000, // 30 days
		/** add other headers as per requirement */
	};

	if (req.method === "OPTIONS") {
		res.writeHead(204, headers);
		res.end();
		return;
	}

	if (["GET", "POST"].indexOf(req.method) > -1) {
		res.writeHead(200, headers);
		res.end("Hello World");
		return;
	}

	res.writeHead(405, headers);
	res.end(`${req.method} is not allowed for the request.`);
}).listen(port);

let interval = maxInterval;
let timer;

//websocket setup
const io = require("socket.io")(http, {
	cors: { origin: "*" },
});

//we do a little bit of error checking
client.on("error", (err) => console.log("Redis Client Error", err));
async function init() {
	await client.connect();

	io.on("connection", (socket) => {
		console.log("client connected");

		socket.on("frontend to backend", (points, who5) => {
			console.log("frontend to backend", points, who5);
			let data = { points: points, who5: who5 };
			client.LPUSH(process.env.REDIS_KEY, JSON.stringify(data));
		});
	});

	//launch web server
	http.listen(3000, () => console.log("Listening on port 3000"));

	//init starting interval
	timer = setInterval(popFormData, maxInterval);

	//setInterval(popGestures, 1000);
}

async function popFormData() {
	let dataCount = await client.LLEN(process.env.REDIS_KEY);

	if (dataCount > 0) {
		//grab data from database
		let data = JSON.parse(await client.RPOP(process.env.REDIS_KEY));
		//REMOVE BEFORE PUSH, JUST FOR TESTING -----------------------------------------------------------------------------###############
		client.LPUSH(process.env.REDIS_KEY, JSON.stringify(data));
		//emit to clients
		io.emit("backend to visual", data.points, data.who5);

		//adjust interval to match amount of data
		if (dataCount > minData) {
			interval = Math.max(minInterval, maxInterval - dataCount * 100);
		} else {
			interval = Math.min(maxInterval, interval + 100);
		}
		//reset timer
		clearInterval(timer);
		//create new timer
		timer = setInterval(popFormData, interval);
	}
}

init();
