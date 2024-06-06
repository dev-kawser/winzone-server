const express = require('express');
const cors = require('cors');
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
        const registerUserCollection = client.db("contestDb").collection("registerUser")

        // JWT related api

        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "6hr" })
            res.send({ token: token });
        })

        // middlewares

        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "forbidden access" })
            }
            const token = req.headers.authorization.split(" ")[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "forbidden access" })
                    // return res.redirect("/")
                }
                req.decoded = decoded;
                next();
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: "forbidden access" })
            }
            next();
        }



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
        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })


        // get current user
        app.get("/users/current/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const result = await userCollection.findOne({ email: email });
            res.send(result)
        })

        // Update user role
        app.patch("/users/role/:id", verifyToken, verifyAdmin, async (req, res) => {
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
        app.patch("/users/block/:id", verifyToken, verifyAdmin, async (req, res) => {
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
        app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // get admin user
        app.get("/users/admin/:email", verifyToken, async (req, res) => {
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
        app.get("/users/creator/:email", verifyToken, async (req, res) => {
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
        app.delete("/contests/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await contestCollection.deleteOne(query);
            res.send(result);
        })

        // Update contest with comment
        app.patch("/contests/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const { comment } = req.body;

            if (!comment) {
                return res.status(400).send({ message: "Comment is required" });
            }

            try {
                const result = await contestCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { comment: comment } }
                );
                res.send(result);
            } catch (err) {
                console.error(err);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        // Update contest status
        app.patch("/contests/:id/status", verifyToken, async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;

            try {
                const result = await contestCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: status } }
                );
                res.send(result);
            }
            catch (err) {
                console.error(err);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        // get contest via email
        app.get("/contests/email/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const result = await contestCollection.find({ email: email }).toArray();
            res.send(result);
        });

        // single contest
        app.get("/contests/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await contestCollection.findOne(query);
            res.send(result);
        })

        // Update contest
        app.put("/contests/update/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: updatedData
            };

            const result = await contestCollection.updateOne(filter, updateDoc);
            res.send(result)

        });

        // ----------------------------------------------------------------------

        // PAYMENT INTENT
        app.post('/create-payment-intent', verifyToken, async (req, res) => {

            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });

        // for register user
        app.post('/register-contest', verifyToken, async (req, res) => {

            const registrationDetails = req.body;
            const result = await registerUserCollection.insertOne(registrationDetails);

            const contestId = registrationDetails.contestId;

            const filter = { _id: new ObjectId(contestId) };
            const updateDoc = { $inc: { participantsCount: 1 } };

            const updateResult = await contestCollection.updateOne(filter, updateDoc);

            if (result.insertedId && updateResult.modifiedCount > 0) {
                res.send({ success: true, message: "User registered and participant count incremented" });
            } else {
                res.send({ success: false, message: "Failed to register user or increment participant count" });
            }
        });

        // get register user
        app.get("/register-contests", verifyToken, async (req, res) => {
            const result = await registerUserCollection.find().toArray()
            res.send(result)
        })

        // get register user by email 
        app.get("/register-contests/email/:email", verifyToken, async (req, res) => {
            const userEmail = req.params.email;
            const result = await registerUserCollection.find({
                email: userEmail,
                status: "Success"
            }).toArray();
            res.send(result);
        });

        // get register user by email and true
        app.get("/register-contests/email/winner/:email", verifyToken, async (req, res) => {
            const userEmail = req.params.email;
            const result = await registerUserCollection.find({
                email: userEmail,
                winner: true
            }).toArray();
            res.send(result);
        });

        app.put("/register-contests/update/:submissionId", verifyToken, async (req, res) => {
            const submissionId = req.params.submissionId;
            const { winner } = req.body;
            const filter = { _id: new ObjectId(submissionId) };

            // if (winner) {
            //     await registerUserCollection.updateMany(
            //         { contestId: new ObjectId(contestId), _id: { $ne: new ObjectId(submissionId) } },
            //         { $set: { winner: false } },
            //         { session }
            //     );

            const updateDoc = {
                $set: { winner: winner }
            };
            const result = await registerUserCollection.updateOne(filter, updateDoc);
            res.send(result);

        });

        // updating contest registration
        app.patch("/register-contests/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const { submittedTask, participate } = req.body;

            const result = await registerUserCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        submittedTask: submittedTask,
                        participate: participate,
                    },
                }
            );

            res.send(result);
        });














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