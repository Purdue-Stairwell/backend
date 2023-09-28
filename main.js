require("dotenv").config();

const minData = 5;
const redisKey = "stairwell";

//in ms
const maxInterval = 3000;
const minInterval = 1000;

const client = require("redis").createClient(); //database
const http = require("http").createServer(); //web server
const port = 3000;
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

		socket.on("frontend to backend", (points, who5, sprite, color, age) => {
			if (!age) {
				who5 = [3,3,3,3,3];
			} else {
				client.LPUSH("who5", JSON.stringify({who5: who5}));
			}
			console.log("frontend to backend", who5, sprite, color, age);
			let data = { points: points, who5: who5, sprite: sprite, color: color };
			client.LPUSH(process.env.REDIS_KEY, JSON.stringify(data));
			
		});
	});

	//launch web server
	http.listen(port, () => console.log("Listening on port " + port + "..."));

	//init starting interval
	timer = setInterval(popFormData, maxInterval);

	//setInterval(popGestures, 1000);
}

async function popFormData() {
	let dataCount = await client.LLEN(process.env.REDIS_KEY);

	if (dataCount > 0) {
		console.log("Sent to Visual");
		//grab data from database
		let data = JSON.parse(await client.RPOP(process.env.REDIS_KEY));
		//emit to clients
		io.emit("backend to visual", data.points, data.who5, data.sprite, data.color);

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
