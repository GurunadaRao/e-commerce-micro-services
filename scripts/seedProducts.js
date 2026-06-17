const mongoose = require("mongoose");
const Product = require("../product/src/models/product");
const MONGO_URI = "mongodb://localhost:27017/products";
async function run() {
    await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    const products = [];
    for (let i = 1; i <= 100; i++) {
        products.push({
            name: `Product ${i}`,
            price: Math.floor(Math.random() * 200) + 1, // Random price between 1 and 200
            description: `Description for Product ${i}`
        });
    }

    await Product.insertMany(products);
    console.log("Inserted products");
    await mongoose.disconnect();
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});