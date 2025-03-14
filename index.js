const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const port = process.env.PORT || 5000;

const corsOptions = {
	origin: ["http://localhost:5173"],
	credentials: true,
	optionSuccessStatus: 200,
};

// middlewares
app.use([cors(corsOptions), express.json()]);

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

		/**
		 * *JOBS ROUTES
		 */
		//! GET ALL JOBS FROM DB
		app.get("/jobs", async (req, res) => {
			const result = await jobsCollection.find().toArray();
			res.send(result);
		});

		//! GET SINGLE JOB
		app.get("/jobs/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await jobsCollection.findOne(query);
			res.send(result);
		});

		/**
		 * *BIDS ROUTES
		 */

		app.post("/bids", async (req, res) => {
			const body = req.body;
			const result = await bidsCollection.insertOne(body);

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
