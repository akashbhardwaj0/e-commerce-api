const port = 4000;
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs"); // Changed to bcryptjs
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection function
async function connectDB() {
    const dbUser = process.env.DB_USER; // MongoDB username from .env
    const dbPassword = process.env.DB_PASSWORD; // MongoDB password from .env
    const dbURL = `mongodb+srv://${dbUser}:${dbPassword}@cluster0.3ritu.mongodb.net/e-commerce?retryWrites=true&w=majority`;
    
    try {
        await mongoose.connect(dbURL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("MongoDB connected");
    } catch (err) {
        console.error("MongoDB connection error:", err);
        process.exit(1); // Exit process with failure
    }
}

// Connect to MongoDB
connectDB();

// Starting the server
app.listen(port, (err) => {
    if (err) {
        console.error("Error starting server:", err);
    } else {
        console.log("Server running on port: " + port);
    }
});

// Image Storage Engine
const storage = multer.diskStorage({
    destination: "./upload/images",
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// Serve images
app.use('/images', express.static('upload/images'));

// API Creation
app.get("/", (req, res) => {
    res.send("Express App is running");
});

// Product Schema
const Product = mongoose.model("Product", {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    category: { type: String, required: true },
    new_price: { type: Number, required: true },
    old_price: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    available: { type: Boolean, default: true }
});

// Upload endpoint
app.post("/upload", upload.single('product'), (req, res) => {
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    });
});

// Add products
app.post('/addproducts', async (req, res) => {
    let products = await Product.find({});
    let id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    });
    
    await product.save();
    res.json({ success: true, name: req.body.name });
});

// Remove product
app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id });
    res.json({ success: true, name: req.body.name });
});

// Get all products
app.get("/allproducts", async (req, res) => {
    const products = await Product.find({});
    res.send(products);
});

// User Schema
const Users = mongoose.model('Users', new mongoose.Schema({
    name: { type: String },
    email: { type: String, unique: true },
    password: { type: String },
    cartData: { type: Object },
    date: { type: Date, default: Date.now },
}));

// Sign up
app.post("/signup", async (req, res) => {
    let check = await Users.findOne({ email: req.body.email });
    if (check) {
        return res.status(400).json({ success: false, errors: "Existing user found with same email id" });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new Users({
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        cartData: {},
    });
    
    await user.save();
    const data = { user: { id: user.id } };
    const token = jwt.sign(data, process.env.JWT_SECRET);
    res.json({ success: true, token });
});

// Login
app.post("/login", async (req, res) => {
    let user = await Users.findOne({ email: req.body.email });
    if (user) {
        const passCompare = await bcrypt.compare(req.body.password, user.password);
        if (passCompare) {
            const data = { user: { id: user.id } };
            const token = jwt.sign(data, process.env.JWT_SECRET);
            res.json({ success: true, token });
        } else {
            res.status(400).json({ success: false, error: "Wrong Password" });
        }
    } else {
        res.status(400).json({ success: false, error: "Wrong Email Id" });
    }
});

// New collection
app.get("/newcollection", async (req, res) => {
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    res.send(newcollection);
});

// Popular products for women
app.get("/populerinwomen", async (req, res) => {
    let products = await Product.find({ category: "women" });
    let populer_in_women = products.slice(0, 4);
    res.send(populer_in_women);
});

// Middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header("auth-token");
    if (!token) {
        return res.status(401).send({ errors: "Please authenticate using a valid token" });
    } else {
        try {
            const data = jwt.verify(token, process.env.JWT_SECRET);
            req.user = data.user;
            next();
        } catch (error) {
            return res.status(401).send({ errors: "Please authenticate using a valid token" });
        }
    }
};

// Add to cart
app.post("/addtocart", fetchUser, async (req, res) => {
    let userData = await Users.findOne({ _id: req.user.id });
    userData.cartData[req.body.itemID] += 1;
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.send("Added");
});

// Remove from cart
app.post("/removefromcart", fetchUser, async (req, res) => {
    let userData = await Users.findOne({ _id: req.user.id });
    if (userData.cartData[req.body.itemID] > 0) {
        userData.cartData[req.body.itemID] -= 1;
    }
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.send("Removed");
});

// Get cart data
app.post('/getcart', fetchUser, async (req, res) => {
    let userData = await Users.findOne({ _id: req.user.id });
    res.json(userData.cartData);
});
