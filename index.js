const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.MONGODB_URI;

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

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

        const db = client.db('JobsHunting')
        const jobsCollection = db.collection('jobs')
        const userCollection = db.collection('user')
        const bookmarkCollection = db.collection('bookmark')
        const reportCollection = db.collection('report')


        //.............Home API...........
        app.get('/api/alljobs', async (req, res) => {
            try {
                const result = await jobsCollection.find().sort({ createdAt: -1 }).toArray()
                res.status(200).json(
                    {
                        success: true,
                        message: ' Find Successful',
                        result,
                    }
                )
            } catch (error) {
                console.log(error)
                res.status(500).json({ message: 'Failed to Fetch Jobs' })
            }
        })

        //............admin................
        app.get('/api/manage-user', async (req, res) => {
            try {
                const result = await userCollection.find().sort({ createdAt: -1 }).toArray()
                res.status(200).json(
                    {
                        success: true,
                        message: 'User data fetched successfully',
                        result
                    }
                )

            } catch (error) {
                console.log(error)
                res.status(500).json(
                    {
                        success: false,
                        message: 'sothing went wrongs'
                    }
                )
            }
        })

        app.patch("/api/manage-user/block/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                const user = await userCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "User not found",
                    });
                }

                if (user.role === "admin") {
                    return res.status(403).json({
                        success: false,
                        message: "Admin account cannot be modified.",
                    });
                }

                if (status === "blocked") {
                    await userCollection.updateOne(
                        { _id: new ObjectId(id) },
                        {
                            $set: {
                                status: "blocked",
                                blockedAt: new Date(),
                            },
                        }
                    );
                } else {
                    await userCollection.updateOne(
                        { _id: new ObjectId(id) },
                        {
                            $set: {
                                status: "active",
                            },
                            $unset: {
                                blockedAt: "",
                            },
                        }
                    );
                }

                res.send({
                    success: true,
                    message: `User ${status} successfully`,
                });
            } catch (error) {
                console.log(error);

                res.status(500).send({
                    success: false,
                    message: "Server Error",
                });
            }
        });

        app.get("/api/user-status/:email", async (req, res) => {
            const user = await userCollection.findOne({
                email: req.params.email,
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            res.json({
                success: true,
                status: user.status,
            });
        });

        app.delete('/api/user-account/delete/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const result = await userCollection.deleteOne({ _id: new ObjectId(id) })

                if (result.role === "admin") {
                    return res.status(403).json({
                        success: false,
                        message: "Admin account cannot be modified.",
                    });
                }
                res.status(200).json(
                    {
                        success: true,
                        message: 'Account Deleted Successful',
                        result
                    }
                )

            } catch (error) {
                console.log(error)
                res.status(500).json(
                    {
                        success: false,
                        message: 'sothing went wrongs'
                    }
                )
            }
        })

        app.get('/api/black-user', async (req, res) => {
            const result = await userCollection.find({ status: 'blocked' }).sort({ createdAt: -1 }).toArray()
            res.json(result)
        })

        app.get('/api/manage-jobs', async (req, res) => {
            const result = await jobsCollection.find().sort({ createdAt: -1 }).toArray()
            res.json(result)
        })

        app.delete("/api/admin/jobs/:id", async (req, res) => {
            try {
                const { id } = req.params;

                const result = await jobsCollection.deleteOne(
                    { _id: new ObjectId(id) },
                );
                res.status(200).json({
                    success: true,
                    message: `Job Delete successfully`,
                    result
                });
            } catch (error) {
                console.log(error);
                res.status(500).json({
                    success: false,
                    message: "Server Error",
                });
            }
        });

        app.patch("/api/admin/jobs/status/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                const result = await jobsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status,
                            updatedAt: new Date(),
                        },
                    }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Job not found",
                    });
                }

                res.status(200).json({
                    success: true,
                    message: `Job ${status} successfully`,
                });
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    success: false,
                    message: "Server Error",
                });
            }
        });

        //...............Employer API................

        app.get('/api/employer/postedjobs/:email', async (req, res) => {
            try {
                const { email } = req.params;
                if (!email) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email Is required'
                    })
                }
                const result = await jobsCollection.find({ userEmail: email }).sort({ createdAt: -1 }).toArray()
                res.status(200).json({
                    success: true,
                    data: result
                })
            } catch (error) {
                console.log(error)
                res.status(500).json({ message: 'Failed to Fetch Jobs' })
            }
        })

        app.get("/api/employer/applicants/:id", async (req, res) => {
            try {
                const { id } = req.params;

                const job = await jobsCollection.findOne(
                    {
                        _id: new ObjectId(id),
                    },
                    {
                        projection: {
                            title: 1,
                            company: 1,
                            applicants: 1,
                        },
                    }
                );

                if (!job) {
                    return res.status(404).send({
                        success: false,
                        message: "Job not found",
                    });
                }

                res.send({
                    success: true,
                    jobId: job._id,
                    title: job.title,
                    company: job.company,
                    applicants: job.applicants || [],
                });
            } catch (err) {
                console.log(err);

                res.status(500).send({
                    success: false,
                    message: "Server Error",
                });
            }
        });

        app.post('/api/employer/postsjob', async (req, res) => {
            const data = req.body;
            const result = await jobsCollection.insertOne(data)
            res.json(result)
        })

        app.patch('/api/employer/postedjob/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const data = req.body;

                if (!id) {
                    return res.status(400).json(
                        {
                            success: false,
                            message: 'Id is Required!'
                        }
                    )
                }
                const { _id, ...updatedData } = data;

                const result = await jobsCollection.updateOne(
                    {
                        _id: new ObjectId(id)
                    },
                    {
                        $set: {
                            ...updatedData,
                            updatedAt: new Date()
                        }
                    }
                )
                res.status(200).json({
                    success: true,
                    message: 'Jobs Updated Successfull',
                    result
                })
            } catch (error) {
                console.log(error)
                res.status(500).json({ message: 'Failed to Fetch Jobs' })
            }
        })

        app.delete('/api/employer/postedjob/delete/:id', async (req, res) => {
            try {
                const { id } = req.params;
                if (!id) {
                    return res.status(400).json(
                        {
                            success: false,
                            message: 'Id is Required'
                        }
                    )
                }
                const result = await jobsCollection.deleteOne(
                    { _id: new ObjectId(id) }
                )
                res.status(200).json(
                    {
                        success: true,
                        message: 'Delete Successfull',
                        result
                    }
                )
            } catch (error) {
                console.log(error)
                res.status(500).json(
                    {
                        success: false,
                        message: 'Failed To Delete Jobs'
                    }
                )
            }

        })

        app.patch("/api/employer/applicants/status", async (req, res) => {
            try {

                const { jobId, userId, status } = req.body;

                if (!jobId || !userId || !status) {
                    return res.status(400).send({
                        success: false,
                        message: "Missing data",
                    });
                }

                const result = await jobsCollection.updateOne(
                    {
                        _id: new ObjectId(jobId),
                        "applicants.userId": userId,
                    },
                    {
                        $set: {
                            "applicants.$.status": status,
                        },
                    }
                );

                res.send({
                    success: true,
                    message: "Applicant status updated",
                    result,
                });

            } catch (error) {

                console.log(error);

                res.status(500).send({
                    success: false,
                    message: "Server Error",
                });

            }
        });

        app.get("/api/employer/analytics/:email", async (req, res) => {
            try {
                const { email } = req.params;

                const jobs = await jobsCollection
                    .find({ userEmail: email })
                    .toArray();

                const totalJobs = jobs.length;

                const activeJobs = jobs.filter(
                    job => job.status === "active"
                ).length;

                const closedJobs = jobs.filter(
                    job => job.status === "closed"
                ).length;

                let totalApplicants = 0;

                let pending = 0;
                let shortlisted = 0;
                let interview = 0;
                let hired = 0;
                let rejected = 0;

                const applicationsPerJob = [];

                jobs.forEach(job => {

                    const applicants = job.applicants || [];

                    totalApplicants += applicants.length;

                    applicationsPerJob.push({
                        title: job.title,
                        applicants: applicants.length,
                    });

                    applicants.forEach(applicant => {

                        switch (applicant.status) {

                            case "Pending":
                                pending++;
                                break;

                            case "Shortlisted":
                                shortlisted++;
                                break;

                            case "Interview":
                                interview++;
                                break;

                            case "Hired":
                                hired++;
                                break;

                            case "Rejected":
                                rejected++;
                                break;

                        }

                    });

                });

                res.send({

                    success: true,

                    totalJobs,

                    activeJobs,

                    closedJobs,

                    totalApplicants,

                    pending,

                    shortlisted,

                    interview,

                    hired,

                    rejected,

                    applicationsPerJob,

                });

            } catch (err) {

                console.log(err);

                res.status(500).send({

                    success: false,

                    message: "Server Error",

                });

            }
        });

        //...............seeker.....................
        app.get('/api/seeker/applied-jobs/:email', async (req, res) => {
            try {
                const { email } = req.params;
                const result = await jobsCollection.find({ "applicants.email": email }).sort({ createdAt: -1 }).toArray();

                res.status(200).json({
                    success: true,
                    message: "Applied jobs fetched successfully",
                    result,
                });

            } catch (error) {
                console.log(error)
                res.status(500).json(
                    {
                        success: false,
                        message: 'Failed to fetch applied jobs'
                    }
                )
            }

        })

        //...........bookmark................

        app.get("/api/bookmark/:userId", async (req, res) => {
            try {
                const { userId } = req.params;

                const result = await bookmarkCollection
                    .find({ userId }).sort({ updatedAt: -1 })
                    .toArray();

                res.json({
                    success: true,
                    result,
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Server Error",
                });
            }
        });

        app.post('/api/bookmark', async (req, res) => {
            try {
                const data = req.body;

                const isExist = await bookmarkCollection.findOne(
                    {
                        userId: data.userId,
                        jobId: data.jobId
                    }
                )

                if (isExist) {
                    await bookmarkCollection.deleteOne({
                        _id: isExist._id,
                    });

                    return res.json({
                        success: true,
                        bookmarked: false,
                        message: "Bookmark removed successfully",
                    });
                }

                const result = await bookmarkCollection.insertOne(data)
                res.status(200).json(
                    {
                        success: true,
                        message: 'Bookmark added successfully',
                        result
                    }
                )

            } catch (error) {
                console.log(error)
                res.status(500).json({
                    success: false,
                    message: "Internal Server Error",
                });
            }
        })

        //...............report..............

        app.get("/api/report-jobs/:userId", async (req, res) => {
            try {
                const { userId } = req.params;

                const result = await reportCollection.find({ userId }).toArray();

                res.status(200).json({
                    success: true,
                    result,
                });
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    success: false,
                    message: "Something went wrong",
                });
            }
        });

        app.post('/api/report-jobs', async (req, res) => {
            try {
                const data = req.body;
                const isExist = await reportCollection.findOne({ jobId: data.jobId, userId: data.userId })
                if (isExist) {
                    return res.status(400).json(
                        {
                            success: false,
                            message: 'Already Reported'
                        }
                    )
                }
                const result = await reportCollection.insertOne({
                    ...data,
                })
                res.status(200).json(
                    {
                        success: true,
                        message: "Report Added Successfully",
                        result
                    }
                )
            } catch (error) {
                console.log(error)
                res.status(500).json(
                    {
                        success: false,
                        message: 'someThing went Wrong'
                    }
                )
            }
        })


        //..............Cv Upload...............

        app.post("/api/upload-cv", upload.single("cv"), async (req, res) => {
            try {
                const file = req.file;

                if (!file) {
                    return res.status(400).json({
                        success: false,
                        message: "No file uploaded",
                    });
                }

                // console.log(file); 

                const result = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        {
                            resource_type: "raw",
                            folder: "job-cv",
                            public_id: `cv-${Date.now()}.pdf`,
                            use_filename: true,
                            unique_filename: false,
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    ).end(file.buffer);
                });
                // console.log(result)

                const pdfUrl = result.secure_url;
                // const pdfUrl = `${result.secure_url}.pdf`;

                res.status(200).json({
                    success: true,
                    cvUrl: pdfUrl,
                    cvPublicId: result.public_id,
                });

            } catch (error) {
                console.log(error);
                res.status(500).json({
                    success: false,
                    message: "Upload failed",
                });
            }
        });

        app.patch("/api/jobs/apply/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const applicantData = req.body;

                const result = await jobsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $push: {
                            applicants: applicantData
                        }
                    }
                );

                res.status(200).json({
                    success: true,
                    message: "Applied successfully",
                    result
                });

            } catch (error) {
                console.log(error);
                res.status(500).json({
                    success: false,
                    message: "Failed to apply"
                });
            }
        });




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