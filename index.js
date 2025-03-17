const express = require("express");
const cors = require("cors");
var jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

const port = process.env.PORT || 5000;

const corsOptions = {
	origin: ["http://localhost:5173"],
	credentials: true,
	optionSuccessStatus: 200,
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

async function run() {
	try {
		//! COLLECTIONS
		const jobsCollection = client.db("onlineMarketPlaceDB").collection("jobs");
		const bidsCollection = client.db("onlineMarketPlaceDB").collection("bids");

		//! GENERATE JWT Token
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

		app.get("/logout", (req, res) => {
			res
				.clearCookie("token", {
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
		app.get("/my-jobs/:email", async (req, res) => {
			const email = req.params.email;
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
			const result = await bidsCollection.insertOne(body);
			res.send(result);
		});

		//! PERSONAL BIDS
		app.get("/my-bids/:email", async (req, res) => {
			const email = req.params.email;
			const query = { email: email };
			const result = await bidsCollection.find(query).toArray();
			res.send(result);
		});

		//! BIDS REQUESTS
		app.get("/bid-requests/:email", async (req, res) => {
			const email = req.params.email;
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
