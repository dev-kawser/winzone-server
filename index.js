const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
    ]
}));
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.euq4zn2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const userCollection = client.db("contestDb").collection("users")
        const contestCollection = client.db("contestDb").collection("contests")

        // user collection is here

        // add user
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User Already Exists", insertId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // get user
        app.get("/users", async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        // Update user role
        app.patch("/users/role/:id", async (req, res) => {
            const userId = req.params.id;
            const { role } = req.body;
            try {
                const result = await userCollection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { role: role } }
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: "An error occurred while updating the role." });
            }
        });

        // Block/Unblock user
        app.patch("/users/block/:id", async (req, res) => {
            const userId = req.params.id;
            const { blocked } = req.body;
            try {
                const result = await userCollection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { isBlocked: blocked } }
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: "An error occurred while updating the block status." });
            }
        });

        // Delete user
        app.delete("/users/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // get admin user
        app.get("/users/admin/:email", async (req, res) => {
            const email = req.params.email;
            try {
                const user = await userCollection.findOne({ email });
                if (user && user.role === 'admin') {
                    res.send({ admin: true });
                } else {
                    res.send({ admin: false });
                }
            } catch (error) {
                res.status(500).send({ message: "Failed to check admin status", error });
            }
        });

        // get contest creator user
        app.get("/users/creator/:email", async (req, res) => {
            const email = req.params.email;
            try {
                const user = await userCollection.findOne({ email });
                if (user && user.role === 'creator') {
                    res.send({ creator: true });
                } else {
                    res.send({ creator: false });
                }
            } catch (error) {
                res.status(500).send({ message: "Failed to check creator status", error });
            }
        });

        // ---------------------------------------------------------------------------------

        // contest collection is here

        app.post('/contests', async (req, res) => {
            const contest = req.body;
            const result = await contestCollection.insertOne(contest);
            res.send(result);
        })

        // get contest
        app.get("/contests", async (req, res) => {
            const result = await contestCollection.find().toArray()
            res.send(result)
        })

        // Delete contest
        app.delete("/contests/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await contestCollection.deleteOne(query);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('server is running')
})
app.listen(port, () => {
    console.log(`server is running on port: ${port}`);
})