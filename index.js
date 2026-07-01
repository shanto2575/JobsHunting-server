const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGODB_URI;

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Job Portal Server Running");
});

const PORT = process.env.PORT || 5000;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        await client.connect();

        const db=client.db('JobsHunting')
        const jobsCollection=db.collection('jobs')


        app.post('/api/employer/postsjob',async(req,res)=>{
            const data=req.body;
            const result=await jobsCollection.insertOne(data)
            res.json(result)
        })








        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});