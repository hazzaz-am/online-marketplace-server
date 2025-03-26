const express = require("express");
const cors = require("cors");
var jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

const port = process.env.PORT || 5000;

const corsOptions = {
	origin: [
		"http://localhost:5173",
		"https://online-marketplace-16cef.web.app",
		"https://online-marketplace-three.vercel.app",
	],
	credentials: true,
	optionSuccessStatus: 200,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
};

// middlewares
app.use([cors(corsOptions), express.json(), cookieParser()]);

// main route
app.get("/", (_req, res) => {
	res.send({ message: "Server is running" });
});

//! MONGODB CONNECTION
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9oowe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

//! VERIFY JWT TOKEN
const verifyToken = (req, res, next) => {
	const token = req.cookies?.token;
	if (!token) return res.status(401).send("Unauthorized access");

	jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
		if (err) return res.status(401).send("Unauthenticated user");
		req.user = user;
		next();
	});
};

async function run() {
	try {
		//! COLLECTIONS
		const jobsCollection = client.db("onlineMarketPlaceDB").collection("jobs");
		const bidsCollection = client.db("onlineMarketPlaceDB").collection("bids");

		//! GENERATE JWT TOKEN
		app.post("/jwt", async (req, res) => {
			const email = req.body;
			const token = jwt.sign(email, process.env.JWT_SECRET, {
				expiresIn: "1d",
			});
			res
				.cookie("token", token, {
					httpOnly: true,
					secure: process.env.NODE_ENV === "production",
					sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
				})
				.send({ success: true });
		});

		//! REMOVE JWT TOKEN FROM BROWSER
		app.get("/logout", (req, res) => {
			res
				.clearCookie("token", {
					httpOnly: true,
					maxAge: 0,
					secure: process.env.NODE_ENV === "production",
					sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
				})
				.send({ success: true });
		});

		/**
		 * *JOBS ROUTES
		 */

		//! GET ALL JOBS FROM DB
		app.get("/jobs", async (req, res) => {
			const result = await jobsCollection.find().toArray();
			res.send(result);
		});

		//! GET FILTERED JOBS FROM DB
		app.get("/filtered-jobs", async (req, res) => {
			const size = parseInt(req.query.size);
			const page = parseInt(req.query.page) - 1;
			const filter = req.query.filter;
			const sort = req.query.sort;
			const searchText = req.query.search;

			let options = {};
			if (sort) {
				options = { sort: { deadline: sort === "asc" ? 1 : -1 } };
			}

			let query = {
				job_title: { $regex: searchText, $options: "i" },
			};
			if (filter) {
				query.category = filter;
			}
			const result = await jobsCollection
				.find(query, options)
				.skip(page * size)
				.limit(size)
				.toArray();
			res.send(result);
		});

		//! GET TOTAL JOBS FROM DB
		app.get("/total-jobs", async (req, res) => {
			const filter = req.query.filter;
			const searchText = req.query.search;

			let query = {
				job_title: { $regex: searchText, $options: "i" },
			};

			if (filter) {
				query.category = filter;
			}
			const count = await jobsCollection.countDocuments(query);
			res.send({ count });
		});

		//! ADD NEW JOB
		app.post("/jobs", async (req, res) => {
			const jobData = await req.body;
			const result = await jobsCollection.insertOne(jobData);
			res.send(result);
		});

		//! GET SINGLE JOB
		app.get("/jobs/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await jobsCollection.findOne(query);
			res.send(result);
		});

		//! GET JOBS FOR INDIVIDUAL PERSON
		app.get("/my-jobs/:email", verifyToken, async (req, res) => {
			const email = req.params.email;
			const emailFromToken = req?.user?.email;
			if (emailFromToken !== email) {
				return res.status(403).send({ message: "FORBIDDEN ACCESS" });
			}
			const query = { "buyer.email": email };
			const result = await jobsCollection.find(query).toArray();
			res.send(result);
		});

		//! DELETE PERSONAL JOB
		app.delete("/jobs/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await jobsCollection.deleteOne(query);
			res.send(result);
		});

		//! UPDATE PERSONAL JOB
		app.put("/update-job/:id", async (req, res) => {
			const id = req.params.id;
			const jobData = req.body;
			const query = { _id: new ObjectId(id) };
			const options = { upsert: true };
			const updateDoc = {
				$set: {
					...jobData,
				},
			};

			const result = await jobsCollection.updateOne(query, updateDoc, options);
			res.send(result);
		});

		/**
		 * ! BIDS ROUTES
		 */

		//! ALL BIDS
		app.get("/bids", async (_req, res) => {
			const result = await bidsCollection.find().toArray();
			res.send(result);
		});

		//! ADD NEW BID
		app.post("/bids", async (req, res) => {
			const body = req.body;
			const query = {
				email: body.email,
				jobId: body.jobId,
			};
			const bidExists = await bidsCollection.findOne(query);
			if (bidExists) {
				return res.status(400).send("BID ALREADY EXISTED");
			}
			const result = await bidsCollection.insertOne(body);
			res.send(result);
		});

		//! PERSONAL BIDS
		app.get("/my-bids/:email", verifyToken, async (req, res) => {
			const email = req.params.email;
			const emailFromToken = req?.user?.email;

			if (emailFromToken !== email) {
				return res.status(403).send({ message: "FORBIDDEN ACCESS" });
			}
			const query = { email: email };
			const result = await bidsCollection.find(query).toArray();
			res.send(result);
		});

		//! BIDS REQUESTS
		app.get("/bid-requests/:email", verifyToken, async (req, res) => {
			const email = req.params.email;
			const emailFromToken = req?.user?.email;

			if (emailFromToken !== email) {
				return res.status(403).send({ message: "FORBIDDEN ACCESS" });
			}
			const query = { "buyer.email": email };
			const result = await bidsCollection.find(query).toArray();
			res.send(result);
		});

		//! UPDATE BID STATUS
		app.patch("/bids/:id", async (req, res) => {
			const id = req.params.id;
			const status = req.body;
			const query = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: status,
			};
			const result = await bidsCollection.updateOne(query, updateDoc);
			res.send(result);
		});

		// ------------------------------------------------
		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

// app running
app.listen(port, () => {
	console.log(`app is running on PORT: ${port}`);
});
