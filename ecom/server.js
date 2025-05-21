const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/ecommerce', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define schemas
const userSchema = new mongoose.Schema({
    email: String,
    phone: String,
    password: String,
    state: String,
    district: String,
    areaName: String,
    pincode: String,
    cart: [{
        productId: mongoose.Schema.Types.ObjectId,
        name: String,
        price: Number,
        mrp: Number,
        discount: Number,
        mainImage: String, // This will now store base64 data
        quantity: Number,
        size: String,
        color: String,
        brand: String,
        category: String
    }]
});

const productSchema = new mongoose.Schema({
    name: String,
    category: String,
    brand: String,
    sku: String,
    productCode: String,
    price: Number,
    mrp: Number,
    discount: Number,
    stock: Number,
    lowStockAlert: Number,
    deliveryCharge: Number,
    freeDelivery: Boolean,
    sizes: [String],
    colors: [String],
    variants: [String],
    mainImage: { // Store base64 image data with metadata
        data: String, // base64 encoded
        contentType: String,
        originalName: String
    },
    additionalImages: [{ // Array of base64 images
        data: String,
        contentType: String,
        originalName: String
    }],
    shortDescription: String,
    fullDescription: String,
    keyFeatures: [String],
    material: String,
    dimensions: String,
    weight: String,
    warranty: String,
    tags: [String],
    status: String,
    launchDate: Date,
    returnPolicy: String,
    bankOffers: String,
    specialOffer: String
});

const orderSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userDetails: {
        email: String,
        phone: String,
        address: {
            state: String,
            district: String,
            areaName: String,
            pincode: String
        }
    },
    products: [{
        productId: mongoose.Schema.Types.ObjectId,
        name: String,
        price: Number,
        mrp: Number,
        discount: Number,
        quantity: Number,
        size: String,
        color: String,
        mainImage: String, // base64 data
        brand: String,
        category: String
    }],
    totalAmount: Number,
    upiTransactionId: String,
    orderDate: { type: Date, default: Date.now },
    status: { type: String, default: 'Pending' }
});

// Create models
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads (we'll process files to base64 instead of saving to disk)
const upload = multer({
    storage: multer.memoryStorage(), // Store files in memory as Buffer
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit per file
    }
});

// Session management (simplified for demo)
let currentUser = null;
let adminLoggedIn = false;

// Helper function to process uploaded files to base64
const processUploadedFile = (file) => {
    if (!file) return null;
    return {
        data: file.buffer.toString('base64'),
        contentType: file.mimetype,
        originalName: file.originalname
    };
};

// Routes
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NexusShop - Premium E-commerce</title>
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Animate.css -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary-color: #6c63ff;
            --secondary-color: #4d44db;
            --accent-color: #ff6584;
            --dark-color: #2a2a72;
            --light-color: #f8f9fa;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        /* Previous styles remain the same, adding new styles for popups */
        
        .popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s;
        }
        
        .popup-overlay.active {
            opacity: 1;
            visibility: visible;
        }
        
        .popup-content {
            background: white;
            border-radius: 15px;
            padding: 30px;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
            transform: translateY(50px);
            transition: transform 0.3s;
        }
        
        .popup-overlay.active .popup-content {
            transform: translateY(0);
        }
        
        .close-popup {
            position: absolute;
            top: 15px;
            right: 15px;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--accent-color);
            transition: transform 0.3s;
        }
        
        .close-popup:hover {
            transform: rotate(90deg);
        }
        
        /* Rest of your existing styles remain the same */

          
        .product-showcase {
            background: white;
            padding: 80px 0;
            overflow-x: auto;
        }
        
        .product-showcase .container {
            min-width: 1200px; /* Force horizontal scroll */
        }
        
        .product-scroll-container {
            display: flex;
            flex-wrap: nowrap;
            gap: 20px;
            padding-bottom: 20px; /* Space for scrollbar */
        }
        
        .product-card {
            border: none;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
            transition: all 0.3s;
            width: 280px;
            flex: 0 0 auto;
            position: relative;
            cursor: pointer;
        }
        
        .product-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 15px 30px rgba(0,0,0,0.1);
        }
        
        .product-card img {
            height: 200px;
            object-fit: cover;
            transition: transform 0.5s;
        }
        
        .product-card:hover img {
            transform: scale(1.05);
        }
        
        .badge-trending {
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--accent-color);
            color: white;
            font-weight: 600;
            padding: 5px 15px;
            border-radius: 50px;
            animation: pulse 2s infinite;
        }
        
        .product-popup {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s;
        }
        
        .product-popup.active {
            opacity: 1;
            visibility: visible;
        }
        
        .popup-content {
            background: white;
            border-radius: 15px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            text-align: center;
            position: relative;
            transform: scale(0.8);
            transition: transform 0.3s;
        }
        
        .product-popup.active .popup-content {
            transform: scale(1);
        }
        
        .close-popup {
            position: absolute;
            top: 15px;
            right: 15px;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--accent-color);
            transition: transform 0.3s;
        }
        
        .close-popup:hover {
            transform: rotate(90deg);
        }
        
        /* Custom scrollbar */
        .product-showcase::-webkit-scrollbar {
            height: 8px;
        }
        
        .product-showcase::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
        }
        
        .product-showcase::-webkit-scrollbar-thumb {
            background: var(--primary-color);
            border-radius: 10px;
        }
        
        .product-showcase::-webkit-scrollbar-thumb:hover {
            background: var(--secondary-color);
        }
    </style>
</head>
<body>
    <!-- Animated Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark fixed-top" style="background: rgba(42, 42, 114, 0.9); backdrop-filter: blur(10px);">
    <div class="container">
        <a class="navbar-brand animate__animated animate__fadeInLeft" href="/">
            <i class="fas fa-shopping-bag me-2"></i>
            <span class="fw-bold">Nexus</span>Shop
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse animate__animated animate__fadeInRight" id="navbarNav">
            <ul class="navbar-nav ms-auto">
                <li class="nav-item">
                    <a class="nav-link" href="/">Home</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#trending-products">Products</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link popup-trigger" data-popup="about">About</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link popup-trigger" data-popup="contact">Contact</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link btn btn-outline-light ms-2 px-3" href="/login">
                        <i class="fas fa-sign-in-alt me-1"></i> Login
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link btn btn-accent ms-2 px-3" href="/register" style="background: var(--accent-color);">
                        <i class="fas fa-user-plus me-1"></i> Register
                    </a>
                </li>
                ${adminLoggedIn ? `
                <li class="nav-item">
                    <a class="nav-link btn btn-warning ms-2" href="/admin">
                        <i class="fas fa-cog me-1"></i> Admin
                    </a>
                </li>
                ` : ''}
            </ul>
        </div>
    </div>
</nav>

<!-- Add this JavaScript to ensure proper closing behavior -->
<script>
document.addEventListener('DOMContentLoaded', function() {
    // Get all nav links
    const navLinks = document.querySelectorAll('.nav-link:not(.popup-trigger)');
    const navbarToggler = document.querySelector('.navbar-toggler');
    const navbarCollapse = document.querySelector('.navbar-collapse');
    
    // Close navbar when a nav link is clicked (except popup triggers)
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 992) { // Only for mobile view
                const bsCollapse = new bootstrap.Collapse(navbarCollapse, {
                    toggle: false
                });
                bsCollapse.hide();
            }
        });
    });
    
    // Close navbar when clicking outside
    document.addEventListener('click', function(event) {
        const isClickInsideNavbar = document.querySelector('.navbar').contains(event.target);
        const isNavbarOpen = navbarCollapse.classList.contains('show');
        
        if (!isClickInsideNavbar && isNavbarOpen && window.innerWidth < 992) {
            const bsCollapse = new bootstrap.Collapse(navbarCollapse, {
                toggle: false
            });
            bsCollapse.hide();
        }
    });
    
    // Initialize Bootstrap collapse properly
    navbarToggler.addEventListener('click', function() {
        const bsCollapse = new bootstrap.Collapse(navbarCollapse, {
            toggle: true
        });
    });
});
</script>
    <!-- Hero Section (same as before) -->
    <section class="hero-section d-flex align-items-center">
        <div class="container text-center animate__animated animate__fadeInUp">
            <h1 class="main-title display-3 fw-bold mb-4" style="margin-top: 50px;">Welcome to NexusShop</h1>
            <p class="lead mb-5" style="max-width: 700px; margin: 0 auto;">Discover premium products with seamless shopping experience. Enjoy exclusive deals and fast delivery.</p>
            <div class="d-flex justify-content-center gap-3">
                <a href="#trending-products" class="btn btn-neon btn-lg">
                    <i class="fas fa-shopping-cart me-2"></i> Shop Now
                </a>
                <a href="/register" class="btn btn-outline-light btn btn-primary">
                    <i class="fas fa-gem me-2 " ></i> Join Premium
                </a>
            </div>
        </div>
    </section>

    <!-- Features Section (same as before) -->
    <section class="py-5">
        <div class="container py-5">
            <div class="row g-4">
                <div class="col-md-4 animate__animated animate__fadeInLeft">
                    <div class="feature-card text-center">
                        <div class="feature-icon floating">
                            <i class="fas fa-rocket"></i>
                        </div>
                        <h3>Fast Delivery</h3>
                        <p class="text-muted">Get your products delivered within 24 hours with our premium shipping service.</p>
                    </div>
                </div>
                <div class="col-md-4 animate__animated animate__fadeInUp">
                    <div class="feature-card text-center">
                        <div class="feature-icon floating" style="animation-delay: 0.5s;">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <h3>Secure Payments</h3>
                        <p class="text-muted">100% secure payment processing with end-to-end encryption for your safety.</p>
                    </div>
                </div>
                <div class="col-md-4 animate__animated animate__fadeInRight">
                    <div class="feature-card text-center">
                        <div class="feature-icon floating" style="animation-delay: 1s;">
                            <i class="fas fa-headset"></i>
                        </div>
                        <h3>24/7 Support</h3>
                        <p class="text-muted">Our customer support team is available round the clock to assist you.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Product Showcase with ID for scrolling -->
      <section class="product-showcase" id="trending-products">
        <div class="container">
            <div class="text-center mb-5">
                <h2 class="fw-bold">Trending Products</h2>
                <p class="text-muted">Discover our most popular items this week</p>
            </div>
            <div class="product-scroll-container">
                <!-- Product 1 -->
                <div class="product-card" onclick="showProductPopup()">
                    <img src="https://images.unsplash.com/photo-1546868871-7041f2a55e12?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80" class="card-img-top" alt="Wireless Headphones">
                    <span class="badge-trending">Trending</span>
                    <div class="card-body">
                        <h5 class="card-title">Wireless Headphones</h5>
                        <p class="text-muted">Premium sound quality</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0 text-primary">$199.99</h5>
                            <button class="btn btn-sm btn-outline-primary">Add to Cart</button>
                        </div>
                    </div>
                </div>
                
                <!-- Product 2 -->
                <div class="product-card" onclick="showProductPopup()">
                    <img src="https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80" class="card-img-top" alt="Smart Watch">
                    <span class="badge-trending">New</span>
                    <div class="card-body">
                        <h5 class="card-title">Smart Watch Pro</h5>
                        <p class="text-muted">Health & fitness tracker</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0 text-primary">$249.99</h5>
                            <button class="btn btn-sm btn-outline-primary">Add to Cart</button>
                        </div>
                    </div>
                </div>
                
                <!-- Product 3 -->
                <div class="product-card" onclick="showProductPopup()">
                    <img src="https://images.unsplash.com/photo-1603302576837-37561b2e2302?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80" class="card-img-top" alt="DSLR Camera">
                    <span class="badge-trending">Best Seller</span>
                    <div class="card-body">
                        <h5 class="card-title">DSLR Camera</h5>
                        <p class="text-muted">24.2MP 4K Video</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0 text-primary">$599.99</h5>
                            <button class="btn btn-sm btn-outline-primary">Add to Cart</button>
                        </div>
                    </div>
                </div>
                
                <!-- Product 4 -->
                <div class="product-card" onclick="showProductPopup()">
                    <img src="https://images.unsplash.com/photo-1593642632823-8f785ba67e45?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80" class="card-img-top" alt="Gaming Laptop">
                    <span class="badge-trending">Hot</span>
                    <div class="card-body">
                        <h5 class="card-title">Gaming Laptop</h5>
                        <p class="text-muted">RTX 3080, 32GB RAM</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0 text-primary">$1999.99</h5>
                            <button class="btn btn-sm btn-outline-primary">Add to Cart</button>
                        </div>
                    </div>
                </div>
                
                <!-- Product 5 -->
                <div class="product-card" onclick="showProductPopup()">
                    <img src="https://images.unsplash.com/photo-1546054454-aa26e2b734c7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80" class="card-img-top" alt="Wireless Earbuds">
                    <span class="badge-trending">Trending</span>
                    <div class="card-body">
                        <h5 class="card-title">Wireless Earbuds</h5>
                        <p class="text-muted">Noise cancelling</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0 text-primary">$129.99</h5>
                            <button class="btn btn-sm btn-outline-primary">Add to Cart</button>
                        </div>
                    </div>
                </div>
                
                <!-- Product 6 -->
                <div class="product-card" onclick="showProductPopup()">
                    <img src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80" class="card-img-top" alt="Macbook Pro">
                    <span class="badge-trending">Premium</span>
                    <div class="card-body">
                        <h5 class="card-title">Macbook Pro</h5>
                        <p class="text-muted">M2 Chip, 16GB RAM</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0 text-primary">$2199.99</h5>
                            <button class="btn btn-sm btn-outline-primary">Add to Cart</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Product Popup -->
    <div class="product-popup" id="productPopup">
        <div class="popup-content">
            <span class="close-popup" onclick="hideProductPopup()">&times;</span>
            <i class="fas fa-exclamation-circle text-warning mb-3" style="font-size: 3rem;"></i>
            <h3 class="mb-3">Kindly login to home page</h3>
            <p class="text-muted">It's just a sample product. Please login to view real products and make purchases.</p>
            <div class="mt-4">
                <a href="/login" class="btn btn-primary me-2">Login</a>
                <a href="/register" class="btn btn-outline-primary">Register</a>
            </div>
        </div>
    </div>
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Product popup functions
        function showProductPopup() {
            document.getElementById('productPopup').classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        function hideProductPopup() {
            document.getElementById('productPopup').classList.remove('active');
            document.body.style.overflow = '';
        }
        
        // Close popup when clicking outside
        document.getElementById('productPopup').addEventListener('click', function(e) {
            if (e.target === this) {
                hideProductPopup();
            }
        });
        
        // Add hover effect to all product cards
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-10px)';
                this.style.boxShadow = '0 15px 30px rgba(0,0,0,0.1)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.boxShadow = '0 5px 15px rgba(0,0,0,0.05)';
            });
        });
    </script>

    <!-- Newsletter (same as before) -->
    

    <!-- Footer (same as before) -->
    <footer class="footer" style="margin-top: 20px">
        <div class="container">
            <div class="row">
                <div class="col-md-4 mb-4">
                    <h5><i class="fas fa-shopping-bag me-2"></i> NexusShop</h5>
                    <p class="mt-3 text-muted">Premium e-commerce platform offering the best products with exceptional customer service.</p>
                    <div class="mt-4">
                        <a href="#" class="social-icon"><i class="fab fa-facebook-f"></i></a>
                        <a href="#" class="social-icon"><i class="fab fa-twitter"></i></a>
                        <a href="#" class="social-icon"><i class="fab fa-instagram"></i></a>
                        <a href="#" class="social-icon"><i class="fab fa-linkedin-in"></i></a>
                    </div>
                </div>
                <div class="col-md-2 mb-4">
                    <h5>Shop</h5>
                    <ul class="list-unstyled">
                        <li class="mb-2"><a href="#" class="text-muted">All Products</a></li>
                        <li class="mb-2"><a href="#" class="text-muted">Featured</a></li>
                        <li class="mb-2"><a href="#" class="text-muted">New Arrivals</a></li>
                        <li class="mb-2"><a href="#" class="text-muted">Sale Items</a></li>
                    </ul>
                </div>
                <div class="col-md-2 mb-4">
                    <h5>Support</h5>
                    <ul class="list-unstyled">
                        <li class="mb-2"><a href="#" class="text-muted">Contact Us</a></li>
                        <li class="mb-2"><a href="#" class="text-muted">FAQs</a></li>
                        <li class="mb-2"><a href="#" class="text-muted">Shipping</a></li>
                        <li class="mb-2"><a href="#" class="text-muted">Returns</a></li>
                    </ul>
                </div>
                <div class="col-md-4 mb-4">
                    <h5>Contact Info</h5>
                    <ul class="list-unstyled text-muted">
                        <li class="mb-2"><i class="fas fa-map-marker-alt me-2"></i> Rich St, chennai City</li>
                        <li class="mb-2"><i class="fas fa-phone me-2"></i> 7358862602</li>
                        <li class="mb-2"><i class="fas fa-envelope me-2"></i>sailakannans@gmail.com</li>
                    </ul>
                </div>
            </div>
            <hr class="mt-4" style="border-color: rgba(255,255,255,0.1);">
            <div class="row">
                <div class="col-md-6 text-center text-md-start">
                    <p class="mb-0 text-muted">© 2023 NexusShop. All rights reserved.</p>
                </div>
                <div class="col-md-6 text-center text-md-end">
                    <a href="#" class="text-muted me-3">Privacy Policy</a>
                    <a href="#" class="text-muted me-3">Terms of Service</a>
                    <a href="#" class="text-muted">Sitemap</a>
                </div>
            </div>
        </div>
    </footer>

    <!-- About Popup -->
    <div class="popup-overlay" id="about-popup">
        <div class="popup-content">
            <span class="close-popup">&times;</span>
            <h2 class="mb-4">About NexusShop</h2>
            <p>NexusShop is a premium e-commerce platform dedicated to providing high-quality products with exceptional customer service. Founded in 2020, we've grown to become one of the most trusted online shopping destinations.</p>
            <h4 class="mt-4">Our Mission</h4>
            <p>To deliver seamless shopping experiences with carefully curated products, fast delivery, and outstanding customer support.</p>
            <h4 class="mt-4">Our Values</h4>
            <ul>
                <li>Customer satisfaction above all</li>
                <li>Quality products from trusted suppliers</li>
                <li>Transparent and honest business practices</li>
                <li>Continuous innovation in shopping experiences</li>
            </ul>
        </div>
    </div>

    <!-- Contact Popup -->
    <div class="popup-overlay" id="contact-popup">
        <div class="popup-content">
            <span class="close-popup">&times;</span>
            <h2 class="mb-4">Contact Us</h2>
            <div class="row">
                <div class="col-md-6">
                    <h4>Get in Touch</h4>
                    <p><i class="fas fa-map-marker-alt me-2"></i>Rich streat,chennai</p>
                    <p><i class="fas fa-phone me-2"></i>7358862602</p>
                    <p><i class="fas fa-envelope me-2"></i>sailakannans@gmail.com</p>
                    <p><i class="fas fa-clock me-2"></i> Monday-Friday: 9:00 AM - 6:00 PM</p>
                </div>
               
            </div>
        </div>
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Scroll animation (same as before)
            const animatedElements = document.querySelectorAll('.animate__animated');
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add(entry.target.dataset.animation);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            
            animatedElements.forEach(element => {
                observer.observe(element);
            });
            
            // Popup functionality
            const popupTriggers = document.querySelectorAll('.popup-trigger');
            const popups = document.querySelectorAll('.popup-overlay');
            const viewAllProducts = document.getElementById('view-all-products');
            
            popupTriggers.forEach(trigger => {
                trigger.addEventListener('click', function(e) {
                    e.preventDefault();
                    const popupId = this.getAttribute('data-popup') + '-popup';
                    const popup = document.getElementById(popupId);
                    
                    // Hide all popups first
                    popups.forEach(p => p.classList.remove('active'));
                    
                    // Show the selected popup
                    popup.classList.add('active');
                    
                    // Hide the "View All Products" button
                    viewAllProducts.style.display = 'none';
                    
                    // Prevent body scrolling
                    document.body.style.overflow = 'hidden';
                });
            });
            
            // Close popup functionality
            document.querySelectorAll('.close-popup').forEach(closeBtn => {
                closeBtn.addEventListener('click', function() {
                    const popup = this.closest('.popup-overlay');
                    popup.classList.remove('active');
                    
                    // Show the "View All Products" button again
                    viewAllProducts.style.display = 'block';
                    
                    // Restore body scrolling
                    document.body.style.overflow = '';
                });
            });
            
            // Close popup when clicking outside content
            popups.forEach(popup => {
                popup.addEventListener('click', function(e) {
                    if (e.target === this) {
                        this.classList.remove('active');
                        viewAllProducts.style.display = 'block';
                        document.body.style.overflow = '';
                    }
                });
            });
            
            // Smooth scrolling for Products link
            document.querySelector('a[href="#trending-products"]').addEventListener('click', function(e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });
    </script>
</body>
</html>
    `);
});
// Registration routes (unchanged from previous version)
app.get('/register', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Registration - Step 1</title>
            <!-- Bootstrap CSS -->
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <!-- Animate.css -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            <style>
                body {
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                }
                .registration-card {
                    border: none;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                .registration-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
                }
                .registration-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 2rem;
                    text-align: center;
                }
                .registration-body {
                    padding: 2rem;
                    background-color: white;
                }
                .form-control {
                    border-radius: 50px;
                    padding: 12px 20px;
                    margin-bottom: 1.5rem;
                    border: 1px solid #eee;
                }
                .form-control:focus {
                    box-shadow: 0 0 0 0.25rem rgba(102, 126, 234, 0.25);
                    border-color: #667eea;
                }
                .btn-next {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 50px;
                    padding: 12px 30px;
                    font-weight: 600;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    width: 100%;
                    transition: all 0.3s;
                }
                .btn-next:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
                }
                @media (max-width: 576px) {
                    .registration-card {
                        margin: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-md-8 col-lg-6 animate__animated animate__fadeIn">
                        <div class="registration-card">
                            <div class="registration-header">
                                <h1 class="animate__animated animate__fadeInDown">Create Your Account</h1>
                                <p class="mb-0 animate__animated animate__fadeIn animate__delay-1s">Join us in just a few simple steps</p>
                            </div>
                            <div class="registration-body">
                                <form action="/register-step1" method="post">
                                    <div class="mb-3 animate__animated animate__fadeIn animate__delay-1s">
                                        <label for="email" class="form-label">Email address</label>
                                        <input type="email" class="form-control" id="email" name="email" placeholder="Enter your email" required>
                                    </div>
                                    <div class="mb-3 animate__animated animate__fadeIn animate__delay-1.5s">
                                        <label for="phone" class="form-label">Phone number</label>
                                        <input type="text" class="form-control" id="phone" name="phone" placeholder="Enter your phone number" required>
                                    </div>
                                    <div class="mb-4 animate__animated animate__fadeIn animate__delay-2s">
                                        <label for="password" class="form-label">Password</label>
                                        <input type="password" class="form-control" id="password" name="password" placeholder="Create a password" required>
                                    </div>
                                    <div class="animate__animated animate__fadeIn animate__delay-2.5s">
                                        <button type="submit" class="btn btn-primary btn-next">
                                            Continue to Next Step
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right ms-2" viewBox="0 0 16 16">
                                                <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                                            </svg>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Bootstrap JS Bundle with Popper -->
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `);
});
app.post('/register-step1', async (req, res) => {
    const { email, phone, password } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Registration Error</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
                <style>
                    body {
                        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                    }
                    .error-card {
                        border: none;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                        max-width: 500px;
                        margin: 0 auto;
                    }
                    .error-header {
                        background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%);
                        color: white;
                        padding: 2rem;
                        text-align: center;
                        border-radius: 15px 15px 0 0 !important;
                    }
                    .error-body {
                        padding: 2rem;
                        background-color: white;
                        border-radius: 0 0 15px 15px;
                    }
                    .btn-retry {
                        background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%);
                        border: none;
                        border-radius: 50px;
                        padding: 10px 25px;
                        font-weight: 600;
                        margin-top: 1rem;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error-card animate__animated animate__fadeIn">
                        <div class="error-header">
                            <h2><i class="bi bi-exclamation-triangle-fill"></i> Registration Error</h2>
                        </div>
                        <div class="error-body text-center">
                            <p class="lead">User with this email or phone already exists.</p>
                            <a href="/register" class="btn btn-primary btn-retry animate__animated animate__pulse animate__infinite">
                                Try Again
                            </a>
                        </div>
                    </div>
                </div>
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `);
    }
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Registration - Step 2</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
            <style>
                body {
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                }
                .registration-card {
                    border: none;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                .registration-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
                }
                .registration-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 2rem;
                    text-align: center;
                }
                .registration-body {
                    padding: 2rem;
                    background-color: white;
                }
                .form-control {
                    border-radius: 50px;
                    padding: 12px 20px;
                    margin-bottom: 1.5rem;
                    border: 1px solid #eee;
                }
                .form-control:focus {
                    box-shadow: 0 0 0 0.25rem rgba(102, 126, 234, 0.25);
                    border-color: #667eea;
                }
                .btn-register {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 50px;
                    padding: 12px 30px;
                    font-weight: 600;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    width: 100%;
                    transition: all 0.3s;
                }
                .btn-register:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
                }
                .progress-bar {
                    height: 5px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    width: 50%;
                    border-radius: 5px;
                    margin-bottom: 2rem;
                }
                .step-indicator {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 2rem;
                }
                .step {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background-color: #e0e0e0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    color: #999;
                }
                .step.active {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .step.completed {
                    background-color: #4CAF50;
                    color: white;
                }
                @media (max-width: 576px) {
                    .registration-card {
                        margin: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-md-8 col-lg-6 animate__animated animate__fadeIn">
                        <div class="registration-card">
                            <div class="registration-header">
                                <h1 class="animate__animated animate__fadeInDown">Complete Your Profile</h1>
                                <p class="mb-0 animate__animated animate__fadeIn animate__delay-1s">Just a few more details</p>
                            </div>
                            <div class="registration-body">
                                <div class="step-indicator">
                                    <div class="step completed"><i class="bi bi-check"></i></div>
                                    <div class="step active">2</div>
                                </div>
                                <div class="progress-bar"></div>
                                
                                <form action="/register-step2" method="post">
                                    <input type="hidden" name="email" value="${email}">
                                    <input type="hidden" name="phone" value="${phone}">
                                    <input type="hidden" name="password" value="${password}">
                                    
                                    <div class="row">
                                        <div class="col-md-6 animate__animated animate__fadeIn">
                                            <div class="mb-3">
                                                <label for="state" class="form-label">State</label>
                                                <input type="text" class="form-control" id="state" name="state" placeholder="Enter your state" required>
                                            </div>
                                        </div>
                                        <div class="col-md-6 animate__animated animate__fadeIn animate__delay-1s">
                                            <div class="mb-3">
                                                <label for="district" class="form-label">District</label>
                                                <input type="text" class="form-control" id="district" name="district" placeholder="Enter your district" required>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 animate__animated animate__fadeIn animate__delay-2s">
                                            <div class="mb-3">
                                                <label for="areaName" class="form-label">Area Name</label>
                                                <input type="text" class="form-control" id="areaName" name="areaName" placeholder="Enter your area" required>
                                            </div>
                                        </div>
                                        <div class="col-md-6 animate__animated animate__fadeIn animate__delay-3s">
                                            <div class="mb-3">
                                                <label for="pincode" class="form-label">Pincode</label>
                                                <input type="text" class="form-control" id="pincode" name="pincode" placeholder="Enter pincode" required>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="animate__animated animate__fadeIn animate__delay-4s">
                                        <button type="submit" class="btn btn-primary btn-register">
                                            Complete Registration
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-check ms-2" viewBox="0 0 16 16">
                                                <path d="M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H1s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C9.516 10.68 8.289 10 6 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                                                <path fill-rule="evenodd" d="M15.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 0 1 .708-.708L12.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0z"/>
                                            </svg>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `);
});
app.post('/register-step2', async (req, res) => {
    const { email, phone, password, state, district, areaName, pincode } = req.body;
    
    try {
        const newUser = new User({
            email,
            phone,
            password,
            state,
            district,
            areaName,
            pincode,
            cart: []
        });
        
        await newUser.save();
        
        // Success response with Bootstrap styling and animations
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Registration Successful</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
                <style>
                    body {
                        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .success-card {
                        border: none;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                        overflow: hidden;
                        transition: all 0.3s ease;
                    }
                    .success-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
                    }
                    .success-icon {
                        font-size: 5rem;
                        color: #28a745;
                        margin-bottom: 1rem;
                    }
                    .btn-login {
                        transition: all 0.3s ease;
                    }
                    .btn-login:hover {
                        transform: scale(1.05);
                    }
                    @media (max-width: 576px) {
                        .success-card {
                            margin: 20px;
                        }
                        .success-icon {
                            font-size: 3rem;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="row justify-content-center">
                        <div class="col-md-8 col-lg-6">
                            <div class="success-card card animate__animated animate__fadeInUp">
                                <div class="card-body p-5 text-center">
                                    <div class="success-icon animate__animated animate__bounceIn">
                                        <i class="bi bi-check-circle-fill"></i>
                                    </div>
                                    <h2 class="card-title mb-3 animate__animated animate__fadeIn">Registration Successful!</h2>
                                    <p class="card-text mb-4 animate__animated animate__fadeIn animate__delay-1s">
                                        Thank you for registering. You can now login to your account.
                                    </p>
                                    <a href="/login" class="btn btn-success btn-lg btn-login animate__animated animate__fadeIn animate__delay-2s">
                                        Login Now <i class="bi bi-arrow-right ms-2"></i>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css"></script>
            </body>
            </html>
        `);
    } catch (err) {
        // Error response with Bootstrap styling and animations
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Registration Failed</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
                <style>
                    body {
                        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .error-card {
                        border: none;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                        overflow: hidden;
                        transition: all 0.3s ease;
                    }
                    .error-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
                    }
                    .error-icon {
                        font-size: 5rem;
                        color: #dc3545;
                        margin-bottom: 1rem;
                    }
                    .btn-retry {
                        transition: all 0.3s ease;
                    }
                    .btn-retry:hover {
                        transform: scale(1.05);
                    }
                    @media (max-width: 576px) {
                        .error-card {
                            margin: 20px;
                        }
                        .error-icon {
                            font-size: 3rem;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="row justify-content-center">
                        <div class="col-md-8 col-lg-6">
                            <div class="error-card card animate__animated animate__shakeX">
                                <div class="card-body p-5 text-center">
                                    <div class="error-icon animate__animated animate__headShake">
                                        <i class="bi bi-exclamation-triangle-fill"></i>
                                    </div>
                                    <h2 class="card-title mb-3 animate__animated animate__fadeIn">Registration Failed</h2>
                                    <p class="card-text mb-4 animate__animated animate__fadeIn animate__delay-1s">
                                        ${err.message || 'Please try again.'}
                                    </p>
                                    <a href="/register" class="btn btn-danger btn-lg btn-retry animate__animated animate__fadeIn animate__delay-2s">
                                        Try Again <i class="bi bi-arrow-counterclockwise ms-2"></i>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css"></script>
            </body>
            </html>
        `);
    }
});
// Login routes (unchanged from previous version)
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Login</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
            <style>
                :root {
                    --primary-color: #6a11cb;
                    --secondary-color: #2575fc;
                }
                
                * {
                    box-sizing: border-box;
                }
                
                body {
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                    overflow-x: hidden;
                }
                
                .login-container {
                    width: 100%;
                    max-width: 400px;
                    margin: 0 auto;
                }
                
                .login-card {
                    border: none;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.98);
                    animation: fadeInUp 0.5s ease-out;
                }
                
                .login-header {
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
                    color: white;
                    padding: 1.5rem;
                    text-align: center;
                }
                
                .login-icon {
                    font-size: 2.5rem;
                    margin-bottom: 0.5rem;
                    display: inline-block;
                    animation: bounce 2s infinite;
                }
                
                .card-body {
                    padding: 2rem;
                }
                
                .form-control {
                    border-radius: 12px;
                    padding: 14px 20px;
                    margin-bottom: 1.25rem;
                    border: 2px solid #f0f0f0;
                    font-size: 1rem;
                    transition: all 0.3s;
                }
                
                .form-control:focus {
                    box-shadow: 0 0 0 3px rgba(106, 17, 203, 0.15);
                    border-color: var(--primary-color);
                }
                
                .btn-login {
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
                    border: none;
                    border-radius: 12px;
                    padding: 14px;
                    font-weight: 600;
                    font-size: 1rem;
                    letter-spacing: 0.5px;
                    transition: all 0.3s;
                    width: 100%;
                    margin-top: 0.5rem;
                }
                
                .btn-login:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                }
                
                .forgot-password {
                    color: #666;
                    text-decoration: none;
                    font-size: 0.9rem;
                    transition: all 0.3s;
                    display: inline-block;
                    margin-top: 1rem;
                }
                
                .forgot-password:hover {
                    color: var(--primary-color);
                    transform: translateX(3px);
                }
                
                .back-home {
                    color: var(--primary-color);
                    text-decoration: none;
                    font-weight: 500;
                    transition: all 0.3s;
                    display: inline-flex;
                    align-items: center;
                    margin-top: 1.5rem;
                }
                
                .back-home:hover {
                    color: var(--secondary-color);
                    transform: translateX(-3px);
                }
                
                /* Animations */
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% {
                        transform: translateY(0);
                    }
                    40% {
                        transform: translateY(-15px);
                    }
                    60% {
                        transform: translateY(-7px);
                    }
                }
                
                @keyframes float {
                    0% {
                        transform: translateY(0px);
                    }
                    50% {
                        transform: translateY(-5px);
                    }
                    100% {
                        transform: translateY(0px);
                    }
                }
                
                /* Responsive adjustments */
                @media (max-width: 576px) {
                    body {
                        padding: 15px;
                    }
                    
                    .login-card {
                        border-radius: 15px;
                    }
                    
                    .card-body {
                        padding: 1.5rem;
                    }
                    
                    .login-header {
                        padding: 1.25rem;
                    }
                    
                    .login-icon {
                        font-size: 2.25rem;
                    }
                    
                    h1 {
                        font-size: 1.75rem;
                    }
                }
                
                @media (max-width: 400px) {
                    .card-body {
                        padding: 1.25rem;
                    }
                    
                    .form-control {
                        padding: 12px 16px;
                    }
                    
                    .btn-login {
                        padding: 12px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="login-container">
                <div class="login-card card">
                    <div class="login-header">
                        <div class="login-icon">
                            <i class="bi bi-person-fill"></i>
                        </div>
                        <h1 class="animate__animated animate__fadeIn">Welcome</h1>
                    </div>
                    <div class="card-body">
                        <form action="/login" method="post" class="animate__animated animate__fadeIn animate__delay-1s">
                            <div class="mb-3">
                                <label for="username" class="form-label">Email or Phone</label>
                                <input type="text" class="form-control animate__animated animate__fadeIn animate__delay-1s" 
                                       id="username" name="username" placeholder="Enter your email or phone" required>
                            </div>
                            <div class="mb-3">
                                <label for="password" class="form-label">Password</label>
                                <input type="password" class="form-control animate__animated animate__fadeIn animate__delay-2s" 
                                       id="password" name="password" placeholder="Enter your password" required>
                            </div>
                            <button type="submit" class="btn btn-primary btn-login animate__animated animate__fadeIn animate__delay-3s">
                                <i class="bi bi-box-arrow-in-right me-2"></i> Login
                            </button>
                            
                        </form>
                        <div class="text-center animate__animated animate__fadeIn animate__delay-5s">
                            <a href="/" class="back-home">
                                <i class="bi bi-arrow-left me-2"></i> Back to Home
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // Add touch feedback for mobile users
                document.querySelectorAll('.btn-login, .back-home, .forgot-password').forEach(button => {
                    button.addEventListener('touchstart', function() {
                        this.style.transform = 'scale(0.98)';
                    });
                    
                    button.addEventListener('touchend', function() {
                        this.style.transform = '';
                    });
                });
                
                // Prevent zooming on input focus
                document.addEventListener('DOMContentLoaded', function() {
                    document.querySelectorAll('input').forEach(input => {
                        input.addEventListener('focus', function() {
                            window.scrollTo(0, 0);
                            document.body.style.transform = 'scale(1)';
                        });
                    });
                });
            </script>
        </body>
        </html>
    `);
});
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'kanna' && password === 'kanna') {
        adminLoggedIn = true;
        return res.redirect('/admin');
    }
    
    const user = await User.findOne({ 
        $or: [{ email: username }, { phone: username }],
        password: password
    });
    
    if (user) {
        currentUser = user;
        res.redirect('/home');
    } else {
        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Error</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
        
        body {
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            margin: 0;
        }
        
        .error-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
            padding: 2.5rem;
            text-align: center;
            max-width: 450px;
            width: 100%;
            position: relative;
            overflow: hidden;
            animation: fadeInUp 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
        }
        
        .error-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 5px;
            background: linear-gradient(90deg, #ff4757, #ff6b81);
        }
        
        .error-icon {
            font-size: 4rem;
            color: #ff4757;
            margin-bottom: 1.5rem;
            animation: shake 0.8s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        
        h2 {
            color: #2f3542;
            font-weight: 600;
            margin-bottom: 1rem;
        }
        
        .error-message {
            color: #57606f;
            margin-bottom: 1.5rem;
            font-size: 1.05rem;
        }
        
        .btn-retry {
            background: linear-gradient(135deg, #3498db 0%, #2e86de 100%);
            border: none;
            color: white;
            padding: 0.7rem 1.8rem;
            border-radius: 50px;
            font-weight: 500;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
            position: relative;
            overflow: hidden;
        }
        
        .btn-retry:hover {
            transform: translateY(-2px);
            box-shadow: 0 7px 20px rgba(52, 152, 219, 0.4);
            color: white;
        }
        
        .btn-retry::after {
            content: '';
            position: absolute;
            top: -50%;
            left: -60%;
            width: 200%;
            height: 200%;
            background: rgba(255, 255, 255, 0.2);
            transform: rotate(30deg);
            transition: all 0.3s;
        }
        
        .btn-retry:hover::after {
            left: 100%;
        }
        
        .btn-retry i {
            margin-right: 8px;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes shake {
            10%, 90% { transform: translateX(-1px); }
            20%, 80% { transform: translateX(2px); }
            30%, 50%, 70% { transform: translateX(-4px); }
            40%, 60% { transform: translateX(4px); }
        }
        
        @media (max-width: 576px) {
            .error-container {
                padding: 1.8rem;
            }
            
            .error-icon {
                font-size: 3.2rem;
            }
            
            h2 {
                font-size: 1.4rem;
            }
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">
            <i class="fas fa-lock"></i>
        </div>
        <h2>Invalid Credentials</h2>
        <p class="error-message">The username or password you entered is incorrect. Please try again.</p>
        <a href="/login" class="btn btn-retry">
            <i class="fas fa-redo"></i> Try Again
        </a>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
`);
    }
});

// Home page with search functionality
app.get('/home', async (req, res) => {
    if (!currentUser) return res.redirect('/login');
    
    const searchQuery = req.query.search || '';
    let products;
    
    if (searchQuery) {
        products = await Product.find({
            name: { $regex: searchQuery, $options: 'i' }
        });
    } else {
        products = await Product.find();
    }
    
    let productsHtml = '';
    products.forEach(product => {
        const mainImageSrc = `data:${product.mainImage.contentType};base64,${product.mainImage.data}`;
        
        productsHtml += `
            <div class="col-6 col-md-4 col-lg-3 mb-4 product-card">
                <div class="card h-100 shadow-sm">
                    <div class="badge-offer">${product.discount}% OFF</div>
                    <img src="${mainImageSrc}" class="card-img-top product-image" alt="${product.name}">
                    <div class="card-body">
                        <h5 class="card-title product-name">${product.name}</h5>
                        <div class="price-container">
                            <span class="current-price">₹${product.price}</span>
                            <span class="original-price"><strike>₹${product.mrp}</strike></span>
                        </div>
                        <a href="/viewproduct/${product._id}" class="btn btn-primary view-product-btn">View Product</a>
                    </div>
                </div>
            </div>
        `;
    });
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Home | ${currentUser.email}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
            <style>
                :root {
                    --primary-color: #3498db;
                    --secondary-color: #2c3e50;
                    --accent-color: #e74c3c;
                    --light-color: #ecf0f1;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #f8f9fa;
                }
                
                .navbar-brand img {
                    height: 40px;
                    transition: all 0.3s ease;
                }
                
                .navbar-brand:hover img {
                    transform: scale(1.05);
                }
                
                .search-container {
                    flex-grow: 1;
                    max-width: 600px;
                    margin: 0 15px;
                }
                
                .mobile-search-container {
                    display: none;
                    padding: 15px;
                    background-color: white;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                
                .search-container .form-control {
                    border-radius: 20px;
                    padding: 10px 20px;
                    box-shadow: none;
                }
                
                .search-container .btn {
                    border-radius: 20px;
                    margin-left: -45px;
                    z-index: 2;
                }
                
                .navbar-toggler {
                    border: none;
                    padding: 0.5rem;
                }
                
                .navbar-toggler:focus {
                    box-shadow: none;
                }
                
                .product-card {
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                
                .product-card:hover {
                    transform: translateY(-5px);
                }
                
                .product-image {
                    height: 200px;
                    object-fit: contain;
                    padding: 15px;
                    transition: transform 0.3s ease;
                }
                
                .product-card:hover .product-image {
                    transform: scale(1.05);
                }
                
                .product-name {
                    color: var(--secondary-color);
                    font-weight: 600;
                    font-size: 1rem;
                    height: 2.5em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }
                
                .price-container {
                    margin: 10px 0;
                }
                
                .current-price {
                    font-size: 1.2rem;
                    font-weight: bold;
                    color: var(--accent-color);
                }
                
                .original-price {
                    font-size: 0.9rem;
                    color: #6c757d;
                    margin-left: 8px;
                }
                
                .view-product-btn {
                    width: 100%;
                    border-radius: 20px;
                    background-color: var(--primary-color);
                    border: none;
                    transition: all 0.3s ease;
                }
                
                .view-product-btn:hover {
                    background-color: var(--secondary-color);
                    transform: translateY(-2px);
                }
                
                .badge-offer {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background-color: var(--accent-color);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: bold;
                    z-index: 1;
                }
                
                .welcome-message {
                    color: var(--secondary-color);
                    margin: 20px 0;
                    position: relative;
                    padding-left: 20px;
                    font-weight: 600;
                }
                
                .welcome-message:before {
                    content: "";
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 5px;
                    background: linear-gradient(to bottom, var(--primary-color), var(--accent-color));
                    border-radius: 5px;
                }
                
                .welcome-message span {
                    color: var(--primary-color);
                    text-transform: capitalize;
                }
                
                .no-products {
                    text-align: center;
                    padding: 40px;
                    color: #6c757d;
                }
                
                /* Popup Modal Styles */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                }
                
                .modal-overlay.active {
                    opacity: 1;
                    visibility: visible;
                }
                
                .modal-container {
                    background-color: white;
                    border-radius: 10px;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                    max-width: 500px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    transform: translateY(-20px);
                    transition: transform 0.3s ease;
                }
                
                .modal-overlay.active .modal-container {
                    transform: translateY(0);
                }
                
                .modal-header {
                    padding: 15px 20px;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .modal-title {
                    margin: 0;
                    font-size: 1.25rem;
                    color: var(--secondary-color);
                }
                
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #6c757d;
                    transition: color 0.2s;
                }
                
                .modal-close:hover {
                    color: var(--accent-color);
                }
                
                .modal-body {
                    padding: 20px;
                }
                
                .support-info, .contact-info {
                    margin-bottom: 20px;
                }
                
                .info-title {
                    font-weight: 600;
                    color: var(--secondary-color);
                    margin-bottom: 10px;
                }
                
                .info-content {
                    color: #555;
                    line-height: 1.6;
                }
                
                .contact-method {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .contact-method i {
                    margin-right: 10px;
                    color: var(--primary-color);
                    width: 20px;
                    text-align: center;
                }
                
                @media (max-width: 768px) {
                    .search-container {
                        display: none;
                    }
                    
                    .mobile-search-container {
                        display: block;
                    }
                    
                    .navbar-collapse {
                        background-color: white;
                        padding: 15px;
                        border-radius: 10px;
                        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                        margin-top: 10px;
                    }
                    
                    .product-image {
                        height: 150px;
                    }
                    
                    .product-name {
                        font-size: 0.9rem;
                    }
                    
                    .current-price {
                        font-size: 1rem;
                    }
                    
                    .welcome-message {
                        font-size: 1.5rem;
                        padding-left: 15px;
                        margin: 15px 0;
                    }
                    
                    .modal-container {
                        width: 95%;
                    }
                }
                
                @media (max-width: 576px) {
                    .product-card {
                        padding-left: 5px;
                        padding-right: 5px;
                    }
                    
                    .card-body {
                        padding: 10px;
                    }
                    
                    .welcome-message {
                        font-size: 1.3rem;
                        padding-left: 10px;
                    }
                }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm sticky-top">
                <div class="container">
                    <a class="navbar-brand" href="/home">
                      <img src="https://cdn-icons-png.flaticon.com/512/1170/1170678.png" alt="Company Logo" height="40">
                    </a>
                    
                    <div class="search-container d-none d-lg-flex">
                        <form action="/home" method="get" class="d-flex w-100">
                            <input type="text" name="search" class="form-control" placeholder="Search products..." value="${searchQuery}">
                            <button type="submit" class="btn btn-outline-primary">
                                <i class="fas fa-search"></i>
                            </button>
                            ${searchQuery ? '<a href="/home" class="btn btn-outline-secondary ms-2">Clear</a>' : ''}
                        </form>
                    </div>
                    
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    
                    <div class="collapse navbar-collapse" id="navbarContent">
                        <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
                            <li class="nav-item">
                                <a class="nav-link" href="/cart">
                                    <i class="fas fa-shopping-cart"></i> Cart
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link support-btn" href="#" onclick="showSupportModal()">
                                    <i class="fas fa-headset"></i> Support
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link contact-btn" href="#" onclick="showContactModal()">
                                    <i class="fas fa-envelope"></i> Contact
                                </a>
                            </li>
                            <li class="nav-item dropdown">
                                <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown">
                                    <i class="fas fa-user-circle"></i> ${currentUser.email}
                                </a>
                                <ul class="dropdown-menu dropdown-menu-end">
                                    
                                    <li><a class="dropdown-item" href="/logout">Logout</a></li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <!-- Mobile Search Bar (visible only on mobile) -->
            <div class="mobile-search-container d-lg-none">
                <form action="/home" method="get" class="d-flex">
                    <input type="text" name="search" class="form-control" placeholder="Search products..." value="${searchQuery}">
                    <button type="submit" class="btn btn-outline-primary ms-2">
                        <i class="fas fa-search"></i>
                    </button>
                    ${searchQuery ? '<a href="/home" class="btn btn-outline-secondary ms-2">Clear</a>' : ''}
                </form>
            </div>
            
            <div class="container my-4">
                <h2 class="welcome-message">Welcome back, <span>${currentUser.email.split('@')[0]}</span>!</h2>
                
                <div class="row">
                    ${products.length > 0 ? productsHtml : `
                        <div class="no-products">
                            <i class="fas fa-search fa-3x mb-3"></i>
                            <h3>No products found</h3>
                            <p>We couldn't find any products matching "${searchQuery}"</p>
                            <a href="/home" class="btn btn-primary">Browse All Products</a>
                        </div>
                    `}
                </div>
            </div>
            
            <!-- Support Modal -->
            <div class="modal-overlay" id="supportModal">
                <div class="modal-container">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-headset me-2"></i> Customer Support</h3>
                        <button class="modal-close" onclick="hideSupportModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="support-info">
                            <h4 class="info-title">How can we help you?</h4>
                            <div class="info-content">
                                <p>Our customer support team is available to assist you with any questions or issues you may have.</p>
                                <p>Common support topics include:</p>
                                <ul>
                                    <li>Order tracking and status</li>
                                    <li>Returns and refunds</li>
                                    <li>Product information</li>
                                    <li>Payment issues</li>
                                    <li>Account problems</li>
                                </ul>
                            </div>
                        </div>
                        <div class="contact-info">
                            <h4 class="info-title">Contact Options</h4>
                            <div class="contact-method">
                                <i class="fas fa-phone-alt"></i>
                                <span>24/7 Support Hotline: 7358862602</span>
                            </div>
                            <div class="contact-method">
                                <i class="fas fa-envelope"></i>
                                <span>Email: sailakannans@gmail.com</span>
                            </div>
                            <div class="contact-method">
                                <i class="fas fa-comment-alt"></i>
                                <span>Live Chat: whatsapp</span>
                            </div>
                            <div class="contact-method">
                                <i class="fas fa-question-circle"></i>
                                <span>FAQ: <a href="/faq" target="_blank">Visit our FAQ page</a></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Contact Modal -->
            <div class="modal-overlay" id="contactModal">
                <div class="modal-container">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-envelope me-2"></i> Contact Us</h3>
                        <button class="modal-close" onclick="hideContactModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="contact-info">
                            <h4 class="info-title">Get in Touch</h4>
                            <div class="info-content">
                                <p>We'd love to hear from you! Here are the different ways you can reach out to us:</p>
                            </div>
                            <div class="contact-method">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>Rich street chennai, Country</span>
                            </div>
                            <div class="contact-method">
                                <i class="fas fa-phone-alt"></i>
                                <span>Main Office: 7358862602</span>
                            </div>
                            <div class="contact-method">
                                <i class="fas fa-envelope"></i>
                                <span>General Inquiries:sailakannans@gmail.com</span>
                            </div>
                            <div class="contact-method">
                                <i class="fas fa-clock"></i>
                                <span>Business Hours: Monday-Friday, 9AM-5PM EST</span>
                            </div>
                        </div>
                        <div class="support-info mt-4">
                            <h4 class="info-title">Social Media</h4>
                            <div class="info-content">
                                <p>Connect with us on social media for updates and promotions:</p>
                                <div class="d-flex gap-3">
                                    <a href="#" class="text-primary"><i class="fab fa-facebook-f fa-lg"></i></a>
                                    <a href="#" class="text-info"><i class="fab fa-twitter fa-lg"></i></a>
                                    <a href="#" class="text-danger"><i class="fab fa-instagram fa-lg"></i></a>
                                    <a href="#" class="text-primary"><i class="fab fa-linkedin-in fa-lg"></i></a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // Add animation to product cards when they come into view
                const productCards = document.querySelectorAll('.product-card');
                
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.style.opacity = 1;
                            entry.target.style.transform = 'translateY(0)';
                        }
                    });
                }, { threshold: 0.1 });
                
                productCards.forEach(card => {
                    card.style.opacity = 0;
                    card.style.transform = 'translateY(20px)';
                    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    observer.observe(card);
                });
                
                // Modal functions
                function showSupportModal() {
                    event.preventDefault();
                    document.getElementById('supportModal').classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
                
                function hideSupportModal() {
                    document.getElementById('supportModal').classList.remove('active');
                    document.body.style.overflow = 'auto';
                }
                
                function showContactModal() {
                    event.preventDefault();
                    document.getElementById('contactModal').classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
                
                function hideContactModal() {
                    document.getElementById('contactModal').classList.remove('active');
                    document.body.style.overflow = 'auto';
                }
                
                // Close modal when clicking outside
                document.querySelectorAll('.modal-overlay').forEach(modal => {
                    modal.addEventListener('click', function(e) {
                        if (e.target === modal) {
                            modal.classList.remove('active');
                            document.body.style.overflow = 'auto';
                        }
                    });
                });
            </script>
        </body>
        </html>
    `);
});
// View product (updated for base64 images)
app.get('/viewproduct/:id', async (req, res) => {
    if (!currentUser) return res.redirect('/login');
    
    const product = await Product.findById(req.params.id);
    if (!product) return res.send('Product not found');
    
    // Create data URLs for all images
    const mainImageSrc = `data:${product.mainImage.contentType};base64,${product.mainImage.data}`;
    const additionalImagesSrc = product.additionalImages.map(img => 
        `data:${img.contentType};base64,${img.data}`
    );
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${product.name} | Product Details</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet">
            <style>
                :root {
                    --primary-color: #3498db;
                    --secondary-color: #2ecc71;
                    --accent-color: #e74c3c;
                    --text-dark: #2c3e50;
                    --text-light: #7f8c8d;
                }
                
                body {
                    font-family: 'Poppins', sans-serif;
                    color: var(--text-dark);
                }
                
                .brand-font {
                    font-family: 'Montserrat', sans-serif;
                    font-weight: 700;
                    color: var(--primary-color);
                }
                
                .category-badge {
                    background-color: var(--secondary-color);
                    color: white;
                }
                
                .price-highlight {
                    font-size: 1.5rem;
                    color: var(--accent-color);
                    font-weight: 700;
                }
                
                .original-price {
                    color: var(--text-light);
                    font-size: 1.2rem;
                }
                
                .discount-badge {
                    background-color: var(--accent-color);
                    color: white;
                    font-size: 0.9rem;
                }
                
                .stock-badge {
                    background-color: var(--secondary-color);
                    color: white;
                }
                
                .main-image-container {
                    overflow: hidden;
                    border-radius: 10px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    transition: all 0.3s ease;
                }
                
                .main-image-container:hover img {
                    transform: scale(1.05);
                }
                
                .main-image-container img {
                    transition: transform 0.5s ease;
                    cursor: zoom-in;
                    max-height: 500px;
                    object-fit: contain;
                }
                
                .thumbnail-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-top: 15px;
                }
                
                .thumbnail-img {
                    width: 80px;
                    height: 80px;
                    object-fit: cover;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 2px solid transparent;
                }
                
                .thumbnail-img:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 5px 10px rgba(0,0,0,0.2);
                    border-color: var(--primary-color);
                }
                
                .thumbnail-img.active {
                    border-color: var(--accent-color);
                }
                
                .action-buttons {
                    display: flex;
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .btn-add-to-cart {
                    background-color: var(--primary-color);
                    color: white;
                    font-weight: 600;
                    flex: 1;
                }
                
                .btn-buy-now {
                    background-color: var(--accent-color);
                    color: white;
                    font-weight: 600;
                    flex: 1;
                }
                
                .product-specs {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                }
                
                .spec-item {
                    margin-bottom: 15px;
                }
                
                .spec-title {
                    font-weight: 600;
                    color: var(--primary-color);
                    margin-bottom: 5px;
                }
                
                .sticky-actions {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: white;
                    padding: 10px;
                    box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                    z-index: 1000;
                    display: none;
                }
                
                @media (max-width: 768px) {
                    .sticky-actions {
                        display: block;
                    }
                    
                    .action-buttons {
                        display: none;
                    }
                    
                    .main-image-container img {
                        max-height: 300px;
                    }
                }
                
                .back-to-home {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    z-index: 100;
                }
                
                .animate-fade-in {
                    animation: fadeIn 0.5s ease-in;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .feature-list li {
                    position: relative;
                    padding-left: 20px;
                    margin-bottom: 8px;
                }
                
                .feature-list li:before {
                    content: "✓";
                    color: var(--secondary-color);
                    position: absolute;
                    left: 0;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container py-5 animate-fade-in">
                <a href="/home" class="btn btn-outline-primary back-to-home">← Back to Home</a>
                
                <h1 class="mb-4">${product.name}</h1>
                
                <div class="row">
                    <div class="col-lg-6">
                        <div class="main-image-container mb-3">
                            <img src="${mainImageSrc}" id="mainImage" class="img-fluid w-100" alt="${product.name}">
                        </div>
                        
                        <div class="thumbnail-container">
                            <img src="${mainImageSrc}" class="thumbnail-img active" onclick="changeMainImage(this, '${mainImageSrc}')">
                            ${additionalImagesSrc.map(src => `
                                <img src="${src}" class="thumbnail-img" onclick="changeMainImage(this, '${src}')">
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="col-lg-6">
                        <div class="d-flex align-items-center mb-3">
                            <span class="price-highlight me-3">₹${product.price}</span>
                            <span class="original-price me-2"><del>₹${product.mrp}</del></span>
                            <span class="discount-badge badge">${product.discount}% OFF</span>
                        </div>
                        
                        <div class="d-flex align-items-center mb-4">
                            <span class="stock-badge badge me-2">${product.stock} in stock</span>
                            <span class="brand-font me-2">${product.brand}</span>
                            <span class="category-badge badge">${product.category}</span>
                        </div>
                        
                        <form id="productForm" method="post">
                            ${product.sizes.length > 0 ? `
                                <div class="mb-3">
                                    <label class="form-label">Size</label>
                                    <select name="size" class="form-select" required>
                                        <option value="">Select Size</option>
                                        ${product.sizes.map(size => `<option value="${size}">${size}</option>`).join('')}
                                    </select>
                                </div>
                            ` : ''}
                            
                            ${product.colors.length > 0 ? `
                                <div class="mb-3">
                                    <label class="form-label">Color</label>
                                    <select name="color" class="form-select" required>
                                        <option value="">Select Color</option>
                                        ${product.colors.map(color => `<option value="${color}">${color}</option>`).join('')}
                                    </select>
                                </div>
                            ` : ''}
                            
                            <div class="mb-3">
                                <label class="form-label">Quantity</label>
                                <input type="number" name="quantity" class="form-control" value="1" min="1" max="${product.stock}" required>
                            </div>
                            
                            <div class="action-buttons">
                                <button type="submit" formaction="/addtocart/${product._id}" class="btn btn-add-to-cart btn-lg">Add to Cart</button>
                                <button type="submit" formaction="/buynow/${product._id}" class="btn btn-buy-now btn-lg">Buy Now</button>
                            </div>
                        </form>
                        
                        <div class="product-specs">
                            <h3 class="spec-title">Product Details</h3>
                            <p class="spec-item">${product.fullDescription}</p>
                            
                            <h3 class="spec-title">Key Features</h3>
                            <ul class="feature-list">
                                ${product.keyFeatures.map(feature => `<li>${feature}</li>`).join('')}
                            </ul>
                            
                            ${product.material ? `
                                <div class="spec-item">
                                    <h4 class="spec-title">Material</h4>
                                    <p>${product.material}</p>
                                </div>
                            ` : ''}
                            
                            ${product.dimensions ? `
                                <div class="spec-item">
                                    <h4 class="spec-title">Dimensions</h4>
                                    <p>${product.dimensions}</p>
                                </div>
                            ` : ''}
                            
                            ${product.weight ? `
                                <div class="spec-item">
                                    <h4 class="spec-title">Weight</h4>
                                    <p>${product.weight}</p>
                                </div>
                            ` : ''}
                            
                            ${product.warranty ? `
                                <div class="spec-item">
                                    <h4 class="spec-title">Warranty</h4>
                                    <p>${product.warranty}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Mobile sticky actions -->
            <div class="sticky-actions">
                <div class="container">
                    <div class="row">
                        <div class="col-6">
                            <button type="submit" form="productForm" formaction="/addtocart/${product._id}" class="btn btn-add-to-cart w-100">Add to Cart</button>
                        </div>
                        <div class="col-6">
                            <button type="submit" form="productForm" formaction="/buynow/${product._id}" class="btn btn-buy-now w-100">Buy Now</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                function changeMainImage(element, newSrc) {
                    // Update main image
                    document.getElementById('mainImage').src = newSrc;
                    
                    // Update active thumbnail
                    document.querySelectorAll('.thumbnail-img').forEach(img => {
                        img.classList.remove('active');
                    });
                    element.classList.add('active');
                }
                
                // Zoom effect for main image
                const mainImage = document.getElementById('mainImage');
                mainImage.addEventListener('click', function() {
                    if (this.style.transform === 'scale(2)') {
                        this.style.transform = 'scale(1)';
                        this.style.cursor = 'zoom-in';
                    } else {
                        this.style.transform = 'scale(2)';
                        this.style.cursor = 'zoom-out';
                    }
                });

                // Form validation
                document.getElementById('productForm').addEventListener('submit', function(e) {
                    const sizeSelect = this.querySelector('select[name="size"]');
                    const colorSelect = this.querySelector('select[name="color"]');
                    
                    if (sizeSelect && sizeSelect.value === '') {
                        e.preventDefault();
                        alert('Please select a size');
                        sizeSelect.focus();
                        return false;
                    }
                    
                    if (colorSelect && colorSelect.value === '') {
                        e.preventDefault();
                        alert('Please select a color');
                        colorSelect.focus();
                        return false;
                    }
                    
                    return true;
                });
            </script>
        </body>
        </html>
    `);
});
// Add to cart (updated for base64 images)
app.post('/addtocart/:id', async (req, res) => {
    if (!currentUser) return res.redirect('/login');
    
    const productId = req.params.id;
    const { quantity, size, color } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) return res.send('Product not found');
    
    const user = await User.findById(currentUser._id);
    const existingItem = user.cart.find(item => 
        item.productId.toString() === productId && 
        item.size === (size || '') && 
        item.color === (color || '')
    );
    
    if (existingItem) {
        existingItem.quantity += parseInt(quantity);
    } else {
        // Store the base64 image data in the cart
        user.cart.push({
            productId,
            name: product.name,
            price: product.price,
            mrp: product.mrp,
            discount: product.discount,
            mainImage: `data:${product.mainImage.contentType};base64,${product.mainImage.data}`,
            quantity: parseInt(quantity),
            size: size || '',
            color: color || '',
            brand: product.brand,
            category: product.category
        });
    }
    
    await user.save();
    currentUser = user;
    res.redirect('/cart');
});
app.get('/cart', async (req, res) => {
    if (!currentUser) return res.redirect('/login');
    
    const user = await User.findById(currentUser._id);
    let cartHtml = '';
    let total = 0;
    
    user.cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        cartHtml += `
            <div class="cart-item card mb-3 animate__animated animate__fadeInUp" style="animation-delay: ${index * 0.1}s">
                <div class="row g-0">
                    <div class="col-md-3 d-flex align-items-center justify-content-center p-2">
                        <img src="${item.mainImage}" class="img-fluid rounded-start product-image" alt="${item.name}">
                    </div>
                    <div class="col-md-9">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <h5 class="card-title">${item.name}</h5>
                                <a href="/removefromcart/${item._id}" class="btn btn-outline-danger btn-sm remove-btn">
                                    <i class="bi bi-trash"></i>
                                </a>
                            </div>
                            <p class="card-text text-muted">Brand: ${item.brand}</p>
                            <div class="d-flex flex-wrap gap-2 mb-2">
                                ${item.size ? `<span class="badge bg-secondary">Size: ${item.size}</span>` : ''}
                                ${item.color ? `<span class="badge" style="background-color: ${item.color.toLowerCase()}; color: ${getContrastColor(item.color)}">Color: ${item.color}</span>` : ''}
                            </div>
                            <div class="price-section">
                                <span class="text-success fw-bold">₹${item.price} x ${item.quantity} = ₹${itemTotal}</span>
                                <span class="text-decoration-line-through text-muted ms-2">₹${item.mrp}</span>
                                <span class="text-danger ms-2">${item.discount}% OFF</span>
                            </div>
                            <div class="quantity-controls mt-2">
                                <button class="btn btn-sm btn-outline-secondary quantity-btn minus" data-id="${item._id}">-</button>
                                <span class="mx-2 quantity-display">${item.quantity}</span>
                                <button class="btn btn-sm btn-outline-secondary quantity-btn plus" data-id="${item._id}">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Shopping Cart</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            <style>
                :root {
                    --primary-color: #6c63ff;
                    --secondary-color: #f8f9fa;
                    --accent-color: #ff6b6b;
                }
                
                body {
                    background-color: #f5f5f5;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                
                .cart-item {
                    transition: all 0.3s ease;
                    overflow: hidden;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                
                .cart-item:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
                }
                
                .product-image {
                    max-height: 150px;
                    object-fit: contain;
                    transition: transform 0.3s;
                }
                
                .product-image:hover {
                    transform: scale(1.05);
                }
                
                .remove-btn {
                    transition: all 0.2s;
                }
                
                .remove-btn:hover {
                    transform: rotate(15deg);
                }
                
                .quantity-controls {
                    display: flex;
                    align-items: center;
                }
                
                .quantity-btn {
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50% !important;
                }
                
                .summary-card {
                    border-radius: 15px;
                    background: white;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                }
                
                .checkout-btn {
                    background-color: var(--primary-color);
                    border: none;
                    padding: 12px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    transition: all 0.3s;
                }
                
                .checkout-btn:hover {
                    background-color: #5a52e0;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(108, 99, 255, 0.3);
                }
                
                .empty-cart {
                    text-align: center;
                    padding: 50px 0;
                }
                
                .empty-cart-icon {
                    font-size: 5rem;
                    color: #ddd;
                    margin-bottom: 20px;
                    animation: bounce 2s infinite;
                }
                
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
                    40% {transform: translateY(-20px);}
                    60% {transform: translateY(-10px);}
                }
                
                @media (max-width: 768px) {
                    .cart-item {
                        margin-bottom: 15px;
                    }
                    
                    .product-image {
                        max-height: 120px;
                    }
                    
                    .card-title {
                        font-size: 1.1rem;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container py-5">
                <div class="row mb-4">
                    <div class="col">
                        <h1 class="display-5 fw-bold text-center">Your Shopping Cart</h1>
                        <p class="text-center text-muted">Review and proceed to checkout</p>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-lg-8">
                        ${cartHtml || `
                            <div class="empty-cart">
                                <div class="empty-cart-icon">
                                    <i class="bi bi-cart-x"></i>
                                </div>
                                <h3>Your cart is empty</h3>
                                <p class="text-muted">Looks like you haven't added anything to your cart yet</p>
                                <a href="/home" class="btn btn-primary mt-3">Start Shopping</a>
                            </div>
                        `}
                    </div>
                    
                    ${cartHtml ? `
                    <div class="col-lg-4">
                        <div class="summary-card p-4 mb-4 sticky-top" style="top: 20px;">
                            <h4 class="mb-4">Order Summary</h4>
                            <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted">Subtotal</span>
                                <span>₹${total}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted">Shipping</span>
                                <span class="text-success">FREE</span>
                            </div>
                            <hr>
                            <div class="d-flex justify-content-between mb-3">
                                <span class="fw-bold">Total</span>
                                <span class="fw-bold">₹${total}</span>
                            </div>
                           
                            <div class="text-center mt-3">
                                <a href="/home" class="text-decoration-none">
                                    <i class="bi bi-arrow-left me-2"></i>Continue Shopping
                                </a>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // Quantity adjustment functionality
                document.addEventListener('DOMContentLoaded', function() {
                    const quantityBtns = document.querySelectorAll('.quantity-btn');
                    
                    quantityBtns.forEach(btn => {
                        btn.addEventListener('click', function() {
                            const itemId = this.getAttribute('data-id');
                            const isPlus = this.classList.contains('plus');
                            const quantityDisplay = this.parentElement.querySelector('.quantity-display');
                            let quantity = parseInt(quantityDisplay.textContent);
                            
                            if (isPlus) {
                                quantity++;
                            } else if (quantity > 1) {
                                quantity--;
                            }
                            
                            // In a real app, you would send an AJAX request to update the quantity on the server
                            quantityDisplay.textContent = quantity;
                            
                            // Update the price display (simplified - in real app you'd recalculate all prices)
                            const priceSection = this.closest('.card-body').querySelector('.price-section');
                            const unitPrice = parseFloat(priceSection.querySelector('.text-success').textContent.split('=')[0].split('₹')[1].trim());
                            const newPrice = unitPrice * quantity;
                            priceSection.querySelector('.text-success').textContent = \`₹\${unitPrice} x \${quantity} = ₹\${newPrice}\`;
                        });
                    });
                });
            </script>
        </body>
        </html>
    `);
});

// Helper function for color contrast (used in the color badges)
function getContrastColor(hexcolor) {
    // If you're using color names instead of hex, you might need to modify this
    // For simplicity, we'll just return black or white based on some common colors
    const darkColors = ['black', 'navy', 'darkblue', 'midnightblue', 'purple', 'maroon', 'darkred'];
    return darkColors.includes(hexcolor.toLowerCase()) ? 'white' : 'black';
}
// Remove from cart (unchanged)
app.get('/removefromcart/:id', async (req, res) => {
    if (!currentUser) return res.redirect('/login');
    
    const user = await User.findById(currentUser._id);
    user.cart = user.cart.filter(item => item._id.toString() !== req.params.id);
    
    await user.save();
    currentUser = user;
    res.redirect('/cart');
});

// Buy now (updated for base64 images)
app.post('/buynow/:id', async (req, res) => {
    if (!currentUser) return res.redirect('/login');
    
    const productId = req.params.id;
    const { quantity, size, color } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) return res.send('Product not found');
    
    // Create a temporary cart with just this product
    const user = await User.findById(currentUser._id);
    user.cart = [{
        productId,
        name: product.name,
        price: product.price,
        mrp: product.mrp,
        discount: product.discount,
        mainImage: `data:${product.mainImage.contentType};base64,${product.mainImage.data}`,
        quantity: parseInt(quantity),
        size: size || '',
        color: color || '',
        brand: product.brand,
        category: product.category
    }];
    
    await user.save();
    currentUser = user;
    res.redirect('/checkout');
});

// Checkout (unchanged)
app.get('/checkout', async (req, res) => {
    if (!currentUser) return res.redirect('/login');
    
    const user = await User.findById(currentUser._id);
    let total = 0;
    
    user.cart.forEach(item => {
        total += item.price * item.quantity;
    });
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Checkout | Your E-commerce</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
            <style>
                body {
                    background-color: #f8f9fa;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                .checkout-container {
                    animation: fadeIn 0.5s ease-in-out;
                }
                .address-card, .payment-card {
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    background: white;
                }
                .address-card:hover, .payment-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
                }
                .cart-item {
                    transition: all 0.3s ease;
                    border-bottom: 1px solid #eee;
                    padding: 15px 0;
                }
                .cart-item:hover {
                    background-color: #f9f9f9;
                }
                .qr-container {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    animation: pulse 2s infinite;
                }
                .total-amount {
                    font-size: 1.5rem;
                    color: #dc3545;
                    font-weight: bold;
                }
                .btn-checkout {
                    background: linear-gradient(45deg, #ff6b6b, #ff8e53);
                    border: none;
                    transition: all 0.3s ease;
                }
                .btn-checkout:hover {
                    transform: scale(1.02);
                    box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
                }
                .back-to-cart {
                    transition: all 0.3s ease;
                }
                .back-to-cart:hover {
                    transform: translateX(-5px);
                }
                .payment-method-section {
                    background: white;
                    border-radius: 10px;
                    padding: 25px;
                    margin-top: 30px;
                }
            </style>
        </head>
        <body>
            <div class="container py-5 animate__animated animate__fadeIn">
                <div class="row mb-4">
                    <div class="col-12 text-center">
                        <h1 class="display-4 fw-bold text-primary">Checkout</h1>
                        <p class="lead">Review your order before payment</p>
                    </div>
                </div>
                
                <div class="row g-4 mb-4">
                    <div class="col-lg-6">
                        <div class="address-card card h-100 shadow-sm p-4">
                            <h2 class="card-title mb-4 text-primary">
                                <i class="bi bi-geo-alt-fill me-2"></i> Delivery Address
                            </h2>
                            <div class="card-body p-0">
                                <address class="fs-5">
                                    <strong>${currentUser.name}</strong><br>
                                    ${currentUser.areaName}, ${currentUser.district}<br>
                                    ${currentUser.state} - ${currentUser.pincode}<br>
                                    <abbr title="Phone">P:</abbr> ${currentUser.phone}
                                </address>
                                
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-lg-6">
                        <div class="payment-card card h-100 shadow-sm p-4">
                            <h2 class="card-title mb-4 text-primary">
                                <i class="bi bi-cart-check-fill me-2"></i> Order Summary
                            </h2>
                            <div class="card-body p-0">
                                ${user.cart.map(item => `
                                    <div class="cart-item row align-items-center">
                                        <div class="col-3">
                                            <img src="${item.mainImage}" class="img-fluid rounded" alt="${item.name}">
                                        </div>
                                        <div class="col-9">
                                            <h5 class="mb-1">${item.name}</h5>
                                            <p class="mb-1">₹${item.price} × ${item.quantity} = ₹${item.price * item.quantity}</p>
                                            ${item.size ? `<span class="badge bg-secondary me-1">${item.size}</span>` : ''}
                                            ${item.color ? `<span class="badge" style="background-color: ${item.color.toLowerCase()}">${item.color}</span>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                                
                                <hr class="my-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h4 class="mb-0">Total Amount:</h4>
                                    <h4 class="total-amount mb-0">₹${total}</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="payment-method-section shadow-sm">
                    <div class="row">
                        <div class="col-lg-6">
                            <h2 class="mb-4 text-primary">
                                <i class="bi bi-credit-card-fill me-2"></i> Payment Method
                            </h2>
                            <div class="qr-container text-center mb-4">
                                <p class="fw-bold mb-3">Scan QR Code to Pay</p>
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=merchant@upi&pn=E-commerce&am=${total}" 
                                     class="img-fluid mb-3" 
                                     alt="QR Code">
                                <p class="text-muted">Or send payment to UPI ID: <strong>merchant@upi</strong></p>
                            </div>
                        </div>
                        
                        <div class="col-lg-6">
                            <form action="/completeorder" method="post" class="needs-validation" novalidate>
                                <div class="mb-4">
                                    <label for="upiId" class="form-label fw-bold">Enter 12-digit UPI Transaction ID</label>
                                    <input type="text" 
                                           class="form-control form-control-lg" 
                                           id="upiId" 
                                           name="upiId" 
                                           pattern="[0-9]{12}" 
                                           required
                                           placeholder="e.g., 123456789012">
                                    <div class="invalid-feedback">
                                        Please enter a valid 12-digit transaction ID.
                                    </div>
                                </div>
                                
                                <div class="d-grid">
                                    <button type="submit" class="btn btn-checkout btn-lg text-white py-3">
                                        Complete Order <i class="bi bi-lock-fill ms-2"></i>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                
                <div class="text-center mt-4">
                    <a href="/cart" class="back-to-cart text-decoration-none">
                        <i class="bi bi-arrow-left me-2"></i> Back to Cart
                    </a>
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // Form validation
                (function() {
                    'use strict';
                    var forms = document.querySelectorAll('.needs-validation');
                    Array.prototype.slice.call(forms)
                        .forEach(function(form) {
                            form.addEventListener('submit', function(event) {
                                if (!form.checkValidity()) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                }
                                form.classList.add('was-validated');
                            }, false);
                        });
                })();
                
                // Animation for the total amount
                const totalElement = document.querySelector('.total-amount');
                totalElement.addEventListener('mouseover', () => {
                    totalElement.classList.add('animate__animated', 'animate__pulse');
                });
                totalElement.addEventListener('animationend', () => {
                    totalElement.classList.remove('animate__animated', 'animate__pulse');
                });
            </script>
        </body>
        </html>
    `);
});
// Complete order (unchanged)
app.post('/completeorder', async (req, res) => {
    if (!currentUser) return res.redirect('/login');
    
    const user = await User.findById(currentUser._id);
    let total = 0;
    const products = [];
    
    user.cart.forEach(item => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        total += price * quantity;
        
        products.push({
            productId: item.productId,
            name: item.name,
            price: price,
            mrp: item.mrp,
            discount: item.discount,
            quantity: quantity,
            size: item.size,
            color: item.color,
            mainImage: item.mainImage,
            brand: item.brand,
            category: item.category
        });
    });
    
    const order = new Order({
        userId: currentUser._id,
        userDetails: {
            email: currentUser.email,
            phone: currentUser.phone,
            address: {
                state: currentUser.state,
                district: currentUser.district,
                areaName: currentUser.areaName,
                pincode: currentUser.pincode
            }
        },
        products,
        totalAmount: total,
        upiTransactionId: req.body.upiId
    });
    
    await order.save();
    
    // Clear cart
    user.cart = [];
    await user.save();
    currentUser = user;
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            <style>
                body {
                    background-color: #f8f9fa;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                .confirmation-card {
                    border: none;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    transition: all 0.3s ease;
                    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                }
                .confirmation-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
                }
                .confirmation-header {
                    background: linear-gradient(135deg, #4e73df 0%, #224abe 100%);
                    color: white;
                    padding: 2rem;
                    text-align: center;
                }
                .product-card {
                    border-left: 4px solid #4e73df;
                    transition: all 0.3s ease;
                    margin-bottom: 15px;
                    border-radius: 8px;
                }
                .product-card:hover {
                    transform: translateX(5px);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
                }
                .success-icon {
                    font-size: 5rem;
                    color: #28a745;
                    animation: bounceIn 1s;
                }
                .btn-home {
                    background: linear-gradient(135deg, #4e73df 0%, #224abe 100%);
                    border: none;
                    padding: 10px 25px;
                    border-radius: 50px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                }
                .btn-home:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
                }
                .highlight-text {
                    color: #4e73df;
                    font-weight: 600;
                }
                .delivery-badge {
                    background-color: #f8f9fa;
                    color: #4e73df;
                    border: 1px dashed #4e73df;
                    border-radius: 50px;
                    padding: 8px 15px;
                    font-size: 0.9rem;
                }
                @media (max-width: 768px) {
                    .confirmation-header {
                        padding: 1.5rem;
                    }
                    .product-img {
                        width: 60px;
                        height: 60px;
                    }
                    .success-icon {
                        font-size: 3.5rem;
                    }
                }
                .animate-delay-1 {
                    animation-delay: 0.2s;
                }
                .animate-delay-2 {
                    animation-delay: 0.4s;
                }
            </style>
        </head>
        <body>
            <div class="container py-5">
                <div class="row justify-content-center">
                    <div class="col-lg-8 col-md-10">
                        <div class="confirmation-card animate__animated animate__fadeIn">
                            <div class="confirmation-header animate__animated animate__fadeInDown">
                                <div class="mb-3">
                                    <i class="fas fa-check-circle success-icon"></i>
                                </div>
                                <h1 class="fw-bold">Order Placed Successfully!</h1>
                                <p class="mb-0">Thank you for your purchase. Your order has been confirmed.</p>
                            </div>
                            
                            <div class="card-body p-4 animate__animated animate__fadeIn animate-delay-1">
                                <div class="row mb-4">
                                    <div class="col-md-6">
                                        <h5 class="fw-bold">Order Summary</h5>
                                        <p class="mb-1"><span class="text-muted">Order ID:</span> <span class="highlight-text">${order._id}</span></p>
                                        <p class="mb-1"><span class="text-muted">Date:</span> <span class="highlight-text">${new Date().toLocaleDateString()}</span></p>
                                        <p class="mb-1"><span class="text-muted">Total Amount:</span> <span class="highlight-text">₹${total.toFixed(2)}</span></p>
                                    </div>
                                    <div class="col-md-6">
                                        <h5 class="fw-bold">Payment Details</h5>
                                        <p class="mb-1"><span class="text-muted">Payment Method:</span> <span class="highlight-text">UPI</span></p>
                                        <p class="mb-1"><span class="text-muted">Transaction ID:</span> <span class="highlight-text">${req.body.upiId}</span></p>
                                        <p class="mb-1"><span class="text-muted">Status:</span> <span class="badge bg-success">Paid</span></p>
                                    </div>
                                </div>
                                
                                <div class="mb-4 animate__animated animate__fadeIn animate-delay-1">
                                    <h5 class="fw-bold">Delivery Address</h5>
                                    <div class="delivery-badge d-inline-block">
                                        <i class="fas fa-truck me-2"></i>
                                        ${order.userDetails.address.areaName}, ${order.userDetails.address.district}, ${order.userDetails.address.state} - ${order.userDetails.address.pincode}
                                    </div>
                                </div>
                                
                                <h5 class="fw-bold mb-3">Products Ordered</h5>
                                ${order.products.map((product, index) => `
                                    <div class="product-card p-3 animate__animated animate__fadeInUp animate-delay-${index % 3 + 1}">
                                        <div class="d-flex align-items-center">
                                            <img src="${product.mainImage}" alt="${product.name}" class="product-img me-3" width="80" style="border-radius: 8px;">
                                            <div class="flex-grow-1">
                                                <h6 class="fw-bold mb-1">${product.name}</h6>
                                                <p class="mb-1">₹${product.price.toFixed(2)} x ${product.quantity}</p>
                                                ${product.size ? `<p class="mb-1 small text-muted">Size: ${product.size}</p>` : ''}
                                                ${product.color ? `<p class="mb-1 small text-muted">Color: ${product.color}</p>` : ''}
                                            </div>
                                            <div class="text-end">
                                                <p class="fw-bold mb-0">₹${(product.price * product.quantity).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                                
                                <div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                                    <p class="mb-0">We'll notify you when your order ships.</p>
                                    <a href="/home" class="btn btn-home text-white">
                                        <i class="fas fa-home me-2"></i> Back to Home
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="https://kit.fontawesome.com/a076d05399.js" crossorigin="anonymous"></script>
        </body>
        </html>
    `);
});
// Logout (unchanged)
app.get('/logout', (req, res) => {
    currentUser = null;
    adminLoggedIn = false;
    res.redirect('/');
});

// Admin routes (updated for base64 images)
app.get('/admin', (req, res) => {
    if (!adminLoggedIn) return res.redirect('/login');
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Admin Panel</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                :root {
                    --admin-primary: #4e73df;
                    --admin-secondary: #224abe;
                    --admin-dark: #2c3e50;
                    --admin-light: #f8f9fc;
                }
                
                body {
                    background-color: #f8f9fc;
                    font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                }
                
                .admin-header {
                    background: linear-gradient(135deg, var(--admin-primary) 0%, var(--admin-secondary) 100%);
                    color: white;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                }
                
                .admin-card {
                    border: none;
                    border-radius: 0.5rem;
                    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.05);
                    transition: all 0.3s ease;
                    background: white;
                    overflow: hidden;
                }
                
                .admin-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 1rem 1.5rem rgba(0, 0, 0, 0.1);
                }
                
                .admin-card-icon {
                    font-size: 2.5rem;
                    color: var(--admin-primary);
                    margin-bottom: 1rem;
                }
                
                .admin-nav-link {
                    color: var(--admin-dark);
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    transition: all 0.3s ease;
                    font-weight: 600;
                }
                
                .admin-nav-link:hover {
                    background-color: rgba(78, 115, 223, 0.1);
                    color: var(--admin-primary);
                    transform: translateX(5px);
                }
                
                .admin-nav-link i {
                    width: 1.5rem;
                    text-align: center;
                    margin-right: 0.75rem;
                }
                
                .logout-btn {
                    background-color: #e74a3b;
                    color: white;
                    border-radius: 50px;
                    padding: 0.5rem 1.5rem;
                    transition: all 0.3s ease;
                }
                
                .logout-btn:hover {
                    background-color: #be2617;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(231, 74, 59, 0.3);
                }
                
                .welcome-text {
                    position: relative;
                    padding-bottom: 0.5rem;
                }
                
                .welcome-text:after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 50px;
                    height: 3px;
                    background: white;
                    border-radius: 3px;
                }
                
                @media (max-width: 768px) {
                    .admin-card {
                        margin-bottom: 1.5rem;
                    }
                    
                    .admin-nav-link {
                        padding: 0.75rem;
                    }
                }
                
                /* Animation delays */
                .animate-delay-1 { animation-delay: 0.1s; }
                .animate-delay-2 { animation-delay: 0.2s; }
                .animate-delay-3 { animation-delay: 0.3s; }
                .animate-delay-4 { animation-delay: 0.4s; }
                .animate-delay-5 { animation-delay: 0.5s; }
            </style>
        </head>
        <body>
            <header class="admin-header py-4 mb-5">
                <div class="container">
                    <div class="row align-items-center">
                        <div class="col-md-6">
                            <h1 class="fw-bold mb-0 animate__animated animate__fadeInDown">
                                <i class="fas fa-tachometer-alt me-2"></i>Admin Panel
                            </h1>
                        </div>
                        <div class="col-md-6 text-md-end animate__animated animate__fadeInDown animate-delay-1">
                            <span class="welcome-text">Welcome, Admin</span>
                        </div>
                    </div>
                </div>
            </header>
            
            <div class="container">
                <div class="row g-4">
                    <!-- Dashboard Cards -->
                    <div class="col-md-6 col-lg-3 animate__animated animate__fadeInUp animate-delay-1">
                        <a href="/admin/users" class="text-decoration-none">
                            <div class="admin-card p-4 text-center h-100">
                                <div class="admin-card-icon">
                                    <i class="fas fa-users"></i>
                                </div>
                                <h5 class="fw-bold">Users</h5>
                                <p class="text-muted mb-0">Manage all users</p>
                            </div>
                        </a>
                    </div>
                    
                    <div class="col-md-6 col-lg-3 animate__animated animate__fadeInUp animate-delay-2">
                        <a href="/admin/orders" class="text-decoration-none">
                            <div class="admin-card p-4 text-center h-100">
                                <div class="admin-card-icon">
                                    <i class="fas fa-shopping-cart"></i>
                                </div>
                                <h5 class="fw-bold">Orders</h5>
                                <p class="text-muted mb-0">View all orders</p>
                            </div>
                        </a>
                    </div>
                    
                    <div class="col-md-6 col-lg-3 animate__animated animate__fadeInUp animate-delay-3">
                        <a href="/admin/products" class="text-decoration-none">
                            <div class="admin-card p-4 text-center h-100">
                                <div class="admin-card-icon">
                                    <i class="fas fa-box-open"></i>
                                </div>
                                <h5 class="fw-bold">Products</h5>
                                <p class="text-muted mb-0">Manage products</p>
                            </div>
                        </a>
                    </div>
                    
                    <div class="col-md-6 col-lg-3 animate__animated animate__fadeInUp animate-delay-4">
                        <a href="/admin/addproduct" class="text-decoration-none">
                            <div class="admin-card p-4 text-center h-100">
                                <div class="admin-card-icon">
                                    <i class="fas fa-plus-circle"></i>
                                </div>
                                <h5 class="fw-bold">Add Product</h5>
                                <p class="text-muted mb-0">Create new product</p>
                            </div>
                        </a>
                    </div>
                </div>
                
                <!-- Quick Links Section -->
                <div class="row mt-5">
                    <div class="col-lg-8 mx-auto animate__animated animate__fadeIn animate-delay-2">
                        <div class="admin-card p-4">
                            
                            
                            <div class="text-center mt-4 animate__animated animate__fadeIn animate-delay-5">
                                <a href="/logout" class="btn logout-btn">
                                    <i class="fas fa-sign-out-alt me-2"></i> Logout
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <footer class="mt-5 py-4 text-center text-muted">
                <div class="container">
                    <p class="mb-0">Admin Panel &copy; ${new Date().getFullYear()}</p>
                </div>
            </footer>
            
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // Add active class to current nav item
                document.addEventListener('DOMContentLoaded', function() {
                    const currentUrl = window.location.pathname;
                    const navLinks = document.querySelectorAll('.admin-nav-link');
                    
                    navLinks.forEach(link => {
                        if (link.getAttribute('href') === currentUrl) {
                            link.classList.add('active');
                            link.style.backgroundColor = 'rgba(78, 115, 223, 0.1)';
                            link.style.color = 'var(--admin-primary)';
                        }
                    });
                });
            </script>
        </body>
        </html>
    `);
});
// Admin - Users (unchanged)
app.get('/admin/users', async (req, res) => {
    if (!adminLoggedIn) return res.redirect('/login');
    
    const users = await User.find();
    let usersHtml = '';
    
    users.forEach((user, index) => {
        usersHtml += `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card user-card h-100 animate__animated animate__fadeInUp" style="animation-delay: ${index * 0.1}s">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h5 class="card-title text-primary">${user.email}</h5>
                                <p class="card-text"><i class="fas fa-phone me-2"></i>${user.phone || 'Not provided'}</p>
                            </div>
                            <span class="badge bg-info rounded-pill">User #${index + 1}</span>
                        </div>
                    </div>
                    <div class="card-footer bg-transparent border-top-0">
                        <a href="/admin/userdetails/${user._id}" class="btn btn-outline-primary btn-sm stretched-link">
                            View Details <i class="fas fa-arrow-right ms-1"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    });
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Admin - User Management</title>
            
            <!-- Bootstrap 5 CSS -->
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            
            <!-- Font Awesome -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            
            <!-- Animate.css -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            
            <!-- Custom CSS -->
            <style>
                :root {
                    --primary-color: #4e73df;
                    --secondary-color: #f8f9fc;
                    --accent-color: #2e59d9;
                }
                
                body {
                    background-color: var(--secondary-color);
                    font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
                }
                
                .navbar-brand {
                    font-weight: 800;
                    font-size: 1.5rem;
                }
                
                .user-card {
                    transition: all 0.3s ease;
                    border-radius: 0.5rem;
                    box-shadow: 0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.1);
                    border: none;
                    overflow: hidden;
                }
                
                .user-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.15);
                }
                
                .page-header {
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
                    color: white;
                    border-radius: 0.5rem;
                    padding: 2rem;
                    margin-bottom: 2rem;
                    box-shadow: 0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.15);
                }
                
                .back-btn {
                    transition: all 0.3s ease;
                }
                
                .back-btn:hover {
                    transform: translateX(-3px);
                }
                
                @media (max-width: 768px) {
                    .page-header {
                        padding: 1.5rem;
                    }
                    
                    .card-title {
                        font-size: 1rem;
                    }
                }
                
                /* Pulse animation for new users (example) */
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(78, 115, 223, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(78, 115, 223, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(78, 115, 223, 0); }
                }
                
                .new-user {
                    animation: pulse 2s infinite;
                }
            </style>
        </head>
        <body>
            <!-- Navigation -->
            <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
                <div class="container">
                    <a class="navbar-brand" href="/admin">Admin Panel</a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link active" href="/admin/users"><i class="fas fa-users me-1"></i> Users</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/login"><i class="fas fa-sign-out-alt me-1"></i> Logout</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <!-- Main Content -->
            <div class="container py-5">
                <div class="page-header animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center flex-wrap">
                        <h1 class="mb-0"><i class="fas fa-users me-2"></i> User Management</h1>
                        <span class="badge bg-light text-dark fs-6">${users.length} Users</span>
                    </div>
                </div>
                
                <!-- User Cards Grid -->
                <div class="row">
                    ${usersHtml}
                </div>
                
                <!-- Back Button -->
                <div class="text-center mt-4 animate__animated animate__fadeIn">
                    <a href="/admin" class="btn btn-outline-secondary back-btn">
                        <i class="fas fa-arrow-left me-1"></i> Back to Admin Dashboard
                    </a>
                </div>
            </div>
            
            <!-- Bootstrap JS Bundle with Popper -->
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            
            <!-- Custom JS for animations -->
            <script>
                // Add intersection observer for scroll animations
                document.addEventListener('DOMContentLoaded', function() {
                    const observerOptions = {
                        threshold: 0.1
                    };
                    
                    const observer = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                entry.target.classList.add('animate__fadeInUp');
                                observer.unobserve(entry.target);
                            }
                        });
                    }, observerOptions);
                    
                    document.querySelectorAll('.user-card').forEach(card => {
                        observer.observe(card);
                    });
                });
            </script>
        </body>
        </html>
    `);
});
// Admin - User Details (unchanged)
app.get('/admin/userdetails/:id', async (req, res) => {
    if (!adminLoggedIn) return res.redirect('/login');
    
    const user = await User.findById(req.params.id);
    if (!user) return res.send('User not found');
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>User Details | Admin Panel</title>
            
            <!-- Bootstrap 5 CSS -->
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            
            <!-- Font Awesome -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            
            <!-- Animate.css -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            
            <!-- Custom CSS -->
            <style>
                :root {
                    --primary-color: #4e73df;
                    --secondary-color: #f8f9fc;
                    --accent-color: #2e59d9;
                }
                
                body {
                    background-color: var(--secondary-color);
                    font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
                }
                
                .user-profile-card {
                    border-radius: 1rem;
                    box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.1);
                    border: none;
                    overflow: hidden;
                    transition: all 0.3s ease;
                    background: white;
                }
                
                .profile-header {
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
                    color: white;
                    padding: 2rem;
                    text-align: center;
                    position: relative;
                    margin-bottom: 4rem;
                }
                
                .profile-avatar {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    border: 5px solid white;
                    background-color: #f8f9fa;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3rem;
                    color: var(--primary-color);
                    margin: 0 auto;
                    position: absolute;
                    bottom: -60px;
                    left: 0;
                    right: 0;
                    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
                }
                
                .detail-item {
                    padding: 1rem;
                    border-bottom: 1px solid #eee;
                    transition: all 0.3s ease;
                }
                
                .detail-item:hover {
                    background-color: #f8f9fa;
                    transform: translateX(5px);
                }
                
                .detail-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background-color: rgba(78, 115, 223, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary-color);
                    margin-right: 1rem;
                }
                
                .map-container {
                    height: 200px;
                    background-color: #eee;
                    border-radius: 0.5rem;
                    overflow: hidden;
                    position: relative;
                }
                
                .map-placeholder {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
                    color: white;
                }
                
                .back-btn {
                    transition: all 0.3s ease;
                }
                
                .back-btn:hover {
                    transform: translateX(-5px);
                }
                
                @media (max-width: 768px) {
                    .profile-header {
                        padding: 1.5rem;
                    }
                    
                    .profile-avatar {
                        width: 100px;
                        height: 100px;
                        bottom: -50px;
                        font-size: 2.5rem;
                    }
                    
                    .detail-item {
                        padding: 0.75rem;
                    }
                }
                
                /* Animation for loading details */
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .animate-detail {
                    animation: fadeIn 0.5s ease forwards;
                }
            </style>
        </head>
        <body>
            <!-- Navigation -->
            <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
                <div class="container">
                    <a class="navbar-brand" href="/admin">Admin Panel</a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link" href="/admin/users"><i class="fas fa-users me-1"></i> Users</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/admin/logout"><i class="fas fa-sign-out-alt me-1"></i> Logout</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <!-- Main Content -->
            <div class="container py-5">
                <div class="profile-header animate__animated animate__fadeIn">
                    <h1 class="mb-0">User Profile</h1>
                    <div class="profile-avatar animate__animated animate__bounceIn">
                        <i class="fas fa-user"></i>
                    </div>
                </div>
                
                <div class="row justify-content-center">
                    <div class="col-lg-8">
                        <div class="user-profile-card mb-4 animate__animated animate__fadeInUp">
                            <div class="card-body pt-5">
                                <!-- Basic Info -->
                                <div class="d-flex align-items-center detail-item animate-detail" style="animation-delay: 0.1s">
                                    <div class="detail-icon">
                                        <i class="fas fa-envelope"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-0 text-muted">Email</h6>
                                        <p class="mb-0">${user.email}</p>
                                    </div>
                                </div>
                                
                                <div class="d-flex align-items-center detail-item animate-detail" style="animation-delay: 0.2s">
                                    <div class="detail-icon">
                                        <i class="fas fa-phone"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-0 text-muted">Phone</h6>
                                        <p class="mb-0">${user.phone || 'Not provided'}</p>
                                    </div>
                                </div>
                                
                                <!-- Address Section -->
                                <div class="detail-item animate-detail" style="animation-delay: 0.3s">
                                    <h5 class="mb-3"><i class="fas fa-map-marker-alt me-2 text-primary"></i> Address</h5>
                                    
                                    <div class="ps-4">
                                        <div class="d-flex align-items-center mb-2">
                                            <div class="detail-icon">
                                                <i class="fas fa-road"></i>
                                            </div>
                                            <div>
                                                <h6 class="mb-0 text-muted">Area</h6>
                                                <p class="mb-0">${user.areaName || 'Not provided'}</p>
                                            </div>
                                        </div>
                                        
                                        <div class="d-flex align-items-center mb-2">
                                            <div class="detail-icon">
                                                <i class="fas fa-city"></i>
                                            </div>
                                            <div>
                                                <h6 class="mb-0 text-muted">District</h6>
                                                <p class="mb-0">${user.district || 'Not provided'}</p>
                                            </div>
                                        </div>
                                        
                                        <div class="d-flex align-items-center mb-2">
                                            <div class="detail-icon">
                                                <i class="fas fa-flag"></i>
                                            </div>
                                            <div>
                                                <h6 class="mb-0 text-muted">State</h6>
                                                <p class="mb-0">${user.state || 'Not provided'}</p>
                                            </div>
                                        </div>
                                        
                                        <div class="d-flex align-items-center">
                                            <div class="detail-icon">
                                                <i class="fas fa-mail-bulk"></i>
                                            </div>
                                            <div>
                                                <h6 class="mb-0 text-muted">Pincode</h6>
                                                <p class="mb-0">${user.pincode || 'Not provided'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Map Placeholder -->
                                <div class="detail-item animate-detail" style="animation-delay: 0.4s">
                                    <h5 class="mb-3"><i class="fas fa-map me-2 text-primary"></i> Location</h5>
                                    <div class="map-container">
                                        <div class="map-placeholder">
                                            <div class="text-center">
                                                <i class="fas fa-map-marked-alt fa-3x mb-3"></i>
                                                <p>Map would display here with coordinates</p>
                                                <small class="text-white-50">(Integration with Maps API would go here)</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="card-footer bg-transparent border-top-0 text-center py-3">
                                <a href="/admin/users" style="margin-bottom:10px;" class="btn btn-outline-primary back-btn">
                                    <i class="fas fa-arrow-left me-1"></i> Back to Users
                                </a>
                            
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Bootstrap JS Bundle with Popper -->
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            
            <!-- Custom JS for animations -->
<script>
    document.addEventListener('DOMContentLoaded', function() {
        try {
            // Modern animation approach
            var items = document.querySelectorAll('.animate-detail');
            items.forEach(function(item, index) {
                item.style.animationDelay = (index * 0.1) + 's';
            });
        } catch (e) {
            // Fallback if errors occur
            var fallback = document.createElement('style');
            fallback.textContent = [
                '.animate-detail {',
                '  opacity: 1;',
                '  transform: translateY(0);',
                '}'
            ].join(' ');
            document.head.appendChild(fallback);
        }
    });
</script>
        </body>
        </html>
    `);
});
// Admin - Orders (updated for base64 images)
app.get('/admin/orders', async (req, res) => {
    if (!adminLoggedIn) return res.redirect('/login');
    
    const orders = await Order.find().sort({ orderDate: -1 });
    let ordersHtml = '';
    
    orders.forEach((order, index) => {
        let productsHtml = order.products.map(item => `
            <div class="d-flex mb-3 product-item animate__animated animate__fadeIn" style="animation-delay: ${0.2 + (index * 0.05)}s">
                <img src="${item.mainImage}" class="rounded me-3" width="80" height="80" style="object-fit: cover">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${item.name}</h6>
                    <div class="d-flex flex-wrap">
                        <span class="me-2">₹${item.price} × ${item.quantity}</span>
                        ${item.size ? `<span class="badge bg-secondary me-2">${item.size}</span>` : ''}
                        ${item.color ? `<span class="color-badge me-2" style="background-color:${item.color.toLowerCase()}; width:15px; height:15px; border-radius:50%; display:inline-block"></span>` : ''}
                        <span class="text-success fw-bold">₹${item.price * item.quantity}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Status badge color based on order status
        let statusClass = 'bg-secondary';
        if (order.status === 'Delivered') statusClass = 'bg-success';
        if (order.status === 'Shipped') statusClass = 'bg-primary';
        if (order.status === 'Cancelled') statusClass = 'bg-danger';
        if (order.status === 'Processing') statusClass = 'bg-warning text-dark';
        
        ordersHtml += `
            <div class="col-12 mb-4">
                <div class="card order-card animate__animated animate__fadeInUp" style="animation-delay: ${index * 0.1}s">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge ${statusClass} me-2">${order.status}</span>
                            <span class="text-muted">Order #${order._id.toString().substring(18, 24)}</span>
                        </div>
                        <small class="text-muted">${new Date(order.orderDate).toLocaleDateString()}</small>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h5 class="mb-3"><i class="fas fa-user me-2"></i>Customer Details</h5>
                                <div class="ps-3">
                                    <p class="mb-1"><strong>Email:</strong> ${order.userDetails.email}</p>
                                    <p class="mb-1"><strong>Phone:</strong> ${order.userDetails.phone || 'Not provided'}</p>
                                    <p class="mb-0"><strong>Address:</strong> 
                                        ${order.userDetails.address.areaName}, 
                                        ${order.userDetails.address.district}, 
                                        ${order.userDetails.address.state} - 
                                        ${order.userDetails.address.pincode}
                                    </p>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h5 class="mb-3"><i class="fas fa-credit-card me-2"></i>Payment</h5>
                                <div class="ps-3">
                                    <p class="mb-1"><strong>Total:</strong> ₹${order.totalAmount}</p>
                                    <p class="mb-0"><strong>Transaction ID:</strong> ${order.upiTransactionId || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <hr class="my-4">
                        
                        <h5 class="mb-3"><i class="fas fa-box-open me-2"></i>Products (${order.products.length})</h5>
                        ${productsHtml}
                    </div>
                    <div class="card-footer bg-transparent">
                        <div class="d-flex justify-content-between">
                            <a href="/admin" class="btn btn-outline-secondary">
                                <i class="fas fa-arrow-left me-1"></i> Back
                            </a>
                            <div>
                                <button class="btn btn-outline-primary me-2 update-status" data-order-id="${order._id}">
                                    <i class="fas fa-sync-alt me-1"></i> Update Status
                                </button>
                                <button class="btn btn-primary print-order">
                                    <i class="fas fa-print me-1"></i> Print
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Orders Management | Admin Panel</title>
            
            <!-- Bootstrap 5 CSS -->
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            
            <!-- Font Awesome -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            
            <!-- Animate.css -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            
            <!-- Custom CSS -->
            <style>
                :root {
                    --primary-color: #4e73df;
                    --secondary-color: #f8f9fc;
                    --accent-color: #2e59d9;
                }
                
                body {
                    background-color: #f5f7fa;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                
                .navbar-brand {
                    font-weight: 700;
                    font-size: 1.5rem;
                }
                
                .order-card {
                    border: none;
                    border-radius: 0.5rem;
                    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
                    transition: all 0.3s ease;
                    overflow: hidden;
                }
                
                .order-card:hover {
                    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
                    transform: translateY(-2px);
                }
                
                .page-header {
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
                    color: white;
                    border-radius: 0.5rem;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
                }
                
                .product-item {
                    transition: all 0.3s ease;
                    padding: 0.5rem;
                    border-radius: 0.25rem;
                }
                
                .product-item:hover {
                    background-color: rgba(0, 0, 0, 0.03);
                }
                
                .status-badge {
                    font-size: 0.75rem;
                    padding: 0.35em 0.65em;
                }
                
                @media print {
                    .no-print {
                        display: none !important;
                    }
                    
                    .order-card {
                        box-shadow: none;
                        border: 1px solid #ddd !important;
                    }
                }
                
                @media (max-width: 768px) {
                    .page-header {
                        padding: 1rem;
                    }
                    
                    .card-footer .btn {
                        margin-bottom: 0.5rem;
                        width: 100%;
                    }
                    
                    .card-footer .d-flex {
                        flex-direction: column;
                    }
                }
                
                /* Animation for status changes */
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(78, 115, 223, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(78, 115, 223, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(78, 115, 223, 0); }
                }
                
                .updated {
                    animation: pulse 1.5s;
                }
            </style>
        </head>
        <body>
            <!-- Navigation -->
            <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm mb-4 no-print">
                <div class="container">
                    <a class="navbar-brand" href="/admin">Admin Panel</a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link active" href="/admin/orders"><i class="fas fa-shopping-bag me-1"></i> Orders</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/admin/users"><i class="fas fa-users me-1"></i> Users</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/login"><i class="fas fa-sign-out-alt me-1"></i> Logout</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <!-- Main Content -->
            <div class="container mb-5">
                <div class="page-header animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center flex-wrap">
                        <h1 class="mb-0"><i class="fas fa-shopping-bag me-2"></i> Orders Management</h1>
                        <span class="badge bg-light text-dark fs-6">${orders.length} Orders</span>
                    </div>
                </div>
                
                <!-- Status Filter -->
                <div class="row mb-4 no-print animate__animated animate__fadeIn">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-body py-2">
                                <div class="d-flex flex-wrap align-items-center">
                                    <span class="me-2">Filter:</span>
                                    <a href="/admin/orders" class="btn btn-sm btn-outline-secondary rounded-pill me-2 mb-1">All</a>
                                   
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Orders List -->
                <div class="row">
                    ${ordersHtml || '<div class="col-12"><div class="alert alert-info">No orders found</div></div>'}
                </div>
            </div>
            
            <!-- Bootstrap JS Bundle with Popper -->
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            
            <!-- Custom JS -->
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    // Print order functionality
                    document.querySelectorAll('.print-order').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const orderCard = this.closest('.order-card');
                            const originalContents = document.body.innerHTML;
                            
                            document.body.innerHTML = orderCard.outerHTML;
                            window.print();
                            document.body.innerHTML = originalContents;
                        });
                    });
                    
                    // Update status functionality
                    document.querySelectorAll('.update-status').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const orderId = this.getAttribute('data-order-id');
                            const newStatus = prompt('Update order status:\n(Processing, Shipped, Delivered, Cancelled)');
                            
                            if (newStatus) {
                                fetch('/admin/orders/update-status', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        orderId: orderId,
                                        status: newStatus
                                    })
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        const orderCard = this.closest('.order-card');
                                        orderCard.classList.add('updated');
                                        
                                        setTimeout(() => {
                                            location.reload();
                                        }, 1500);
                                    } else {
                                        alert('Error updating status: ' + data.message);
                                    }
                                })
                                .catch(error => {
                                    console.error('Error:', error);
                                    alert('Error updating status');
                                });
                            }
                        });
                    });
                    
                    // Stagger animations
                    const orderCards = document.querySelectorAll('.order-card');
                    orderCards.forEach((card, index) => {
                        card.style.animationDelay = (index * 0.1) + 's';
                    });
                });
            </script>
        </body>
        </html>
    `);
});
// Admin - Products (updated for base64 images)
app.get('/admin/products', async (req, res) => {
    if (!adminLoggedIn) return res.redirect('/login');
    
    const products = await Product.find().sort({ createdAt: -1 });
    let productsHtml = '';
    
    products.forEach((product, index) => {
        const mainImageSrc = product.mainImage 
            ? `data:${product.mainImage.contentType};base64,${product.mainImage.data}`
            : 'https://via.placeholder.com/150?text=No+Image';
        
        // Stock status indicator
        let stockBadge = '';
        if (product.stock > 20) {
            stockBadge = `<span class="badge bg-success">In Stock (${product.stock})</span>`;
        } else if (product.stock > 0) {
            stockBadge = `<span class="badge bg-warning text-dark">Low Stock (${product.stock})</span>`;
        } else {
            stockBadge = `<span class="badge bg-danger">Out of Stock</span>`;
        }
        
        productsHtml += `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card product-card h-100 animate__animated animate__fadeInUp" style="animation-delay: ${index * 0.1}s">
                    <div class="product-image-container">
                        <img src="${mainImageSrc}" class="card-img-top product-image" alt="${product.name}">
                        <div class="product-actions">
                            <a href="/admin/editproduct/${product._id}" class="btn btn-sm btn-primary" data-bs-toggle="tooltip" title="Edit">
                                <i class="fas fa-edit"></i>
                            </a>
                            <a href="/admin/deleteproduct/${product._id}" class="btn btn-sm btn-danger" 
                               onclick="return confirm('Are you sure you want to delete this product?')" 
                               data-bs-toggle="tooltip" title="Delete">
                                <i class="fas fa-trash-alt"></i>
                            </a>
                        </div>
                    </div>
                    <div class="card-body">
                        <h5 class="card-title">${product.name}</h5>
                        <p class="text-muted brand-text">${product.brand}</p>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="price">₹${product.price}</span>
                            ${stockBadge}
                        </div>
                        <div class="product-meta">
                            <small class="text-muted">Added: ${new Date(product.createdAt).toLocaleDateString()}</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Product Management | Admin Panel</title>
            
            <!-- Bootstrap 5 CSS -->
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            
            <!-- Font Awesome -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            
            <!-- Animate.css -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            
            <!-- Custom CSS -->
            <style>
                :root {
                    --primary-color: #4e73df;
                    --secondary-color: #f8f9fc;
                    --accent-color: #2e59d9;
                }
                
                body {
                    background-color: #f8f9fa;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                
                .navbar-brand {
                    font-weight: 700;
                    font-size: 1.5rem;
                }
                
                .product-card {
                    border: none;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
                    transition: all 0.3s ease;
                    overflow: hidden;
                }
                
                .product-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
                }
                
                .product-image-container {
                    position: relative;
                    overflow: hidden;
                    height: 200px;
                    background-color: #f5f5f5;
                }
                
                .product-image {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    padding: 20px;
                    transition: all 0.3s ease;
                }
                
                .product-actions {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    opacity: 0;
                    transition: all 0.3s ease;
                }
                
                .product-card:hover .product-actions {
                    opacity: 1;
                }
                
                .product-actions a {
                    width: 30px;
                    height: 30px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    margin-left: 5px;
                }
                
                .brand-text {
                    font-family: 'Montserrat', sans-serif;
                    font-weight: 500;
                    color: #6c757d;
                }
                
                .price {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: var(--primary-color);
                }
                
                .page-header {
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
                    color: white;
                    border-radius: 10px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                
                .add-product-btn {
                    transition: all 0.3s ease;
                }
                
                .add-product-btn:hover {
                    transform: translateY(-2px);
                }
                
                @media (max-width: 768px) {
                    .page-header {
                        padding: 1rem;
                    }
                    
                    .product-image-container {
                        height: 150px;
                    }
                    
                    .product-actions {
                        opacity: 1;
                    }
                }
                
                /* Animation for new products */
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(78, 115, 223, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(78, 115, 223, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(78, 115, 223, 0); }
                }
                
                .new-product {
                    animation: pulse 2s infinite;
                }
            </style>
        </head>
        <body>
            <!-- Navigation -->
            <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm mb-4">
                <div class="container">
                    <a class="navbar-brand" href="/admin">Admin Panel</a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link active" href="/admin/products"><i class="fas fa-boxes me-1"></i> Products</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/admin/orders"><i class="fas fa-shopping-bag me-1"></i> Orders</a>
                            </li>
                          
                        </ul>
                    </div>
                </div>
            </nav>
            
            <!-- Main Content -->
            <div class="container mb-5">
                <div class="page-header animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center flex-wrap">
                        <h1 class="mb-0"><i class="fas fa-boxes me-2"></i> Product Management</h1>
                        <span class="badge bg-light text-dark fs-6">${products.length} Products</span>
                    </div>
                </div>
                
                <!-- Search and Filter Bar -->
                <div class="row mb-4 animate__animated animate__fadeIn">
                    <div class="col-md-8">
                        <div class="input-group">
                            <span class="input-group-text"><i class="fas fa-search"></i></span>
                            <input type="text" class="form-control" placeholder="Search products..." id="searchInput">
                            <button class="btn btn-outline-secondary" type="button">Filter</button>
                        </div>
                    </div>
                    <div class="col-md-4 text-md-end mt-2 mt-md-0">
                        <a href="/admin/addproduct" class="btn btn-primary add-product-btn">
                            <i class="fas fa-plus me-1"></i> Add New Product
                        </a>
                    </div>
                </div>
                
                <!-- Products Grid -->
                <div class="row" id="productsContainer">
                    ${productsHtml || `
                    <div class="col-12">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i> No products found. 
                            <a href="/admin/addproduct" class="alert-link">Add your first product</a>
                        </div>
                    </div>
                    `}
                </div>
                
                <!-- Back Button -->
                <div class="text-center mt-4">
                    <a href="/admin" class="btn btn-outline-secondary">
                        <i class="fas fa-arrow-left me-1"></i> Back to Admin Panel
                    </a>
                </div>
            </div>
            
            <!-- Bootstrap JS Bundle with Popper -->
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            
            <!-- Custom JS -->
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    // Initialize tooltips
                    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
                    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
                        return new bootstrap.Tooltip(tooltipTriggerEl);
                    });
                    
                    // Search functionality
                    document.getElementById('searchInput').addEventListener('input', function() {
                        const searchTerm = this.value.toLowerCase();
                        const productCards = document.querySelectorAll('.product-card');
                        
                        productCards.forEach(card => {
                            const title = card.querySelector('.card-title').textContent.toLowerCase();
                            const brand = card.querySelector('.brand-text').textContent.toLowerCase();
                            
                            if (title.includes(searchTerm) || brand.includes(searchTerm)) {
                                card.parentElement.style.display = 'block';
                            } else {
                                card.parentElement.style.display = 'none';
                            }
                        });
                    });
                    
                    // Highlight new products (added in last 7 days)
                    const productCards = document.querySelectorAll('.product-card');
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    
                    productCards.forEach(card => {
                        const dateText = card.querySelector('.product-meta small').textContent;
                        const dateAdded = new Date(dateText.split(': ')[1]);
                        
                        if (dateAdded > weekAgo) {
                            card.classList.add('new-product');
                        }
                    });
                });
            </script>
        </body>
        </html>
    `);
});
// Admin - Add Product (updated for base64 images)
app.get('/admin/addproduct', (req, res) => {
    if (!adminLoggedIn) return res.redirect('/login');
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Add Product</title>
            <!-- Bootstrap CSS -->
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <!-- Animate.css -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            <style>
                body {
                    background-color: #f8f9fa;
                    padding-top: 20px;
                }
                .form-section {
                    background: white;
                    border-radius: 10px;
                    padding: 25px;
                    margin-bottom: 30px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                }
                .form-section:hover {
                    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
                    transform: translateY(-2px);
                }
                .form-header {
                    border-bottom: 2px solid #eee;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                    color: #333;
                }
                .btn-submit {
                    background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
                    border: none;
                    padding: 10px 25px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                }
                .btn-submit:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                }
                .back-link {
                    display: inline-block;
                    margin-top: 20px;
                    color: #6c757d;
                    transition: all 0.2s ease;
                }
                .back-link:hover {
                    color: #0d6efd;
                    transform: translateX(-3px);
                }
                @media (max-width: 768px) {
                    .form-section {
                        padding: 15px;
                    }
                    .form-header h2 {
                        font-size: 1.3rem;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container animate__animated animate__fadeIn">
                <div class="row justify-content-center">
                    <div class="col-lg-10">
                        <h1 class="text-center mb-4">Add Product</h1>
                        
                        <form action="/admin/addproduct" method="post" enctype="multipart/form-data">
                            <!-- Basic Product Information -->
                            <div class="form-section animate__animated animate__fadeInUp">
                                <div class="form-header">
                                    <h2>📋 Basic Product Information</h2>
                                </div>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Product Name</label>
                                        <input type="text" class="form-control" name="name" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Category</label>
                                        <input type="text" class="form-control" name="category" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Brand</label>
                                        <input type="text" class="form-control" name="brand" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">SKU/ID</label>
                                        <input type="text" class="form-control" name="sku" required>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Product Code</label>
                                        <input type="text" class="form-control" name="productCode">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Pricing & Availability -->
                            <div class="form-section animate__animated animate__fadeInUp animate__delay-1s">
                                <div class="form-header">
                                    <h2>💰 Pricing & Availability</h2>
                                </div>
                                <div class="row g-3">
                                    <div class="col-md-4">
                                        <label class="form-label">Price</label>
                                        <input type="number" class="form-control" name="price" required>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">MRP</label>
                                        <input type="number" class="form-control" name="mrp" required>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Discount</label>
                                        <input type="number" class="form-control" name="discount" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Stock Quantity</label>
                                        <input type="number" class="form-control" name="stock" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Low Stock Alert</label>
                                        <input type="number" class="form-control" name="lowStockAlert">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Delivery Charge</label>
                                        <input type="number" class="form-control" name="deliveryCharge" value="0">
                                    </div>
                                    <div class="col-md-6 d-flex align-items-center">
                                        <div class="form-check form-switch mt-3">
                                            <input class="form-check-input" type="checkbox" name="freeDelivery" id="freeDelivery">
                                            <label class="form-check-label" for="freeDelivery">Free Delivery</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Product Variants -->
                            <div class="form-section animate__animated animate__fadeInUp animate__delay-2s">
                                <div class="form-header">
                                    <h2>📦 Product Variants</h2>
                                </div>
                                <div class="row g-3">
                                    <div class="col-md-4">
                                        <label class="form-label">Available Sizes (comma separated)</label>
                                        <input type="text" class="form-control" name="sizes">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Available Colors (comma separated)</label>
                                        <input type="text" class="form-control" name="colors">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Other Variants (comma separated)</label>
                                        <input type="text" class="form-control" name="variants">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Images -->
                            <div class="form-section animate__animated animate__fadeInUp animate__delay-3s">
                                <div class="form-header">
                                    <h2>🖼️ Images</h2>
                                </div>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Main Product Image</label>
                                        <input type="file" class="form-control" name="mainImage" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Additional Images</label>
                                        <input type="file" class="form-control" name="additionalImages" multiple>
                                        <small class="text-muted">Hold Ctrl/Cmd to select multiple images</small>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Description & Specifications -->
                            <div class="form-section animate__animated animate__fadeInUp animate__delay-4s">
                                <div class="form-header">
                                    <h2>📃 Description & Specifications</h2>
                                </div>
                                <div class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label">Short Description</label>
                                        <textarea class="form-control" name="shortDescription" rows="2" required></textarea>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Full Description</label>
                                        <textarea class="form-control" name="fullDescription" rows="4" required></textarea>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Key Features (comma separated)</label>
                                        <textarea class="form-control" name="keyFeatures" rows="3" required></textarea>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Material</label>
                                        <input type="text" class="form-control" name="material">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Dimensions</label>
                                        <input type="text" class="form-control" name="dimensions">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Weight</label>
                                        <input type="text" class="form-control" name="weight">
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Warranty Info</label>
                                        <input type="text" class="form-control" name="warranty">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Additional Information -->
                            <div class="form-section animate__animated animate__fadeInUp animate__delay-5s">
                                <div class="form-header">
                                    <h2>🔧 Additional Information (Optional)</h2>
                                </div>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Tags (comma separated)</label>
                                        <input type="text" class="form-control" name="tags">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Product Status</label>
                                        <select class="form-select" name="status">
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Launch Date</label>
                                        <input type="date" class="form-control" name="launchDate">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Return Policy</label>
                                        <input type="text" class="form-control" name="returnPolicy">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Bank Offers</label>
                                        <input type="text" class="form-control" name="bankOffers">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Special Offer</label>
                                        <input type="text" class="form-control" name="specialOffer">
                                    </div>
                                </div>
                            </div>
                            
                            <div class="text-center mt-4">
                                <button type="submit" class="btn btn-primary btn-submit animate__animated animate__pulse animate__infinite">
                                    Add Product
                                </button>
                                <a href="/admin/products" class="back-link animate__animated animate__fadeIn">
                                    <i class="bi bi-arrow-left"></i> Back to Products
                                </a>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            
            <!-- Bootstrap Icons -->
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
            <!-- Bootstrap JS Bundle with Popper -->
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `);
});
app.post('/admin/addproduct', upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 5 }
]), async (req, res) => {
    if (!adminLoggedIn) return res.redirect('/login');
    
    try {
        const {
            name, category, brand, sku, productCode,
            price, mrp, discount, stock, lowStockAlert, deliveryCharge, freeDelivery,
            sizes, colors, variants,
            shortDescription, fullDescription, keyFeatures, material, dimensions, weight, warranty,
            tags, status, launchDate, returnPolicy, bankOffers, specialOffer
        } = req.body;
        
        // Process uploaded files to base64
        const mainImage = processUploadedFile(req.files.mainImage[0]);
        
        let additionalImages = [];
        if (req.files.additionalImages) {
            additionalImages = req.files.additionalImages.map(file => processUploadedFile(file));
        }
        
        const newProduct = new Product({
            name, category, brand, sku, productCode,
            price: parseFloat(price),
            mrp: parseFloat(mrp),
            discount: parseFloat(discount),
            stock: parseInt(stock),
            lowStockAlert: lowStockAlert ? parseInt(lowStockAlert) : 0,
            deliveryCharge: parseFloat(deliveryCharge || 0),
            freeDelivery: freeDelivery === 'on',
            sizes: sizes ? sizes.split(',').map(s => s.trim()) : [],
            colors: colors ? colors.split(',').map(c => c.trim()) : [],
            variants: variants ? variants.split(',').map(v => v.trim()) : [],
            mainImage,
            additionalImages,
            shortDescription, fullDescription,
            keyFeatures: keyFeatures.split(',').map(f => f.trim()),
            material, dimensions, weight, warranty,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            status: status || 'Active',
            launchDate: launchDate ? new Date(launchDate) : null,
            returnPolicy, bankOffers, specialOffer
        });
        
        await newProduct.save();
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error Adding Product | Admin Panel</title>
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- Animate.css -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --primary-color: #4e73df;
            --error-color: #e74c3c;
            --light-bg: #f8f9fa;
        }
        
        body {
            font-family: 'Poppins', sans-serif;
            background-color: var(--light-bg);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        
        .error-container {
            max-width: 500px;
            width: 100%;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            text-align: center;
            animation: fadeInUp 0.6s ease-out;
        }
        
        .error-header {
            background: linear-gradient(135deg, var(--error-color) 0%, #c0392b 100%);
            color: white;
            padding: 30px 20px;
            position: relative;
        }
        
        .error-icon {
            font-size: 5rem;
            margin-bottom: 20px;
            animation: bounce 1.5s infinite;
        }
        
        .error-body {
            padding: 30px;
        }
        
        .error-title {
            font-size: 1.8rem;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--error-color);
        }
        
        .error-message {
            font-size: 1.1rem;
            color: #555;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .btn-retry {
            background: var(--primary-color);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 50px;
            font-weight: 500;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(78, 115, 223, 0.3);
        }
        
        .btn-retry:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(78, 115, 223, 0.4);
            color: white;
        }
        
        .btn-retry i {
            margin-right: 8px;
        }
        
        /* Animations */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
                transform: translateY(0);
            }
            40% {
                transform: translateY(-20px);
            }
            60% {
                transform: translateY(-10px);
            }
        }
        
        /* Pulse effect for error */
        .pulse-error {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4);
            }
            70% {
                box-shadow: 0 0 0 15px rgba(231, 76, 60, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(231, 76, 60, 0);
            }
        }
        
        /* Responsive adjustments */
        @media (max-width: 576px) {
            .error-header {
                padding: 20px 15px;
            }
            
            .error-icon {
                font-size: 4rem;
            }
            
            .error-title {
                font-size: 1.5rem;
            }
            
            .error-message {
                font-size: 1rem;
            }
            
            .btn-retry {
                padding: 10px 20px;
                font-size: 0.9rem;
            }
        }
    </style>
</head>
<body>
    <div class="error-container pulse-error">
        <div class="error-header">
            <div class="error-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h1 class="error-title">Oops!</h1>
        </div>
        <div class="error-body">
            <p class="error-message">
                There was an error adding your product. Please check your information and try again.
            </p>
            <a href="/admin/addproduct" class="btn-retry">
                <i class="fas fa-redo"></i> Try Again
            </a>
        </div>
    </div>

    <!-- Bootstrap JS Bundle with Popper -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        // Add some interactive effects
        document.addEventListener('DOMContentLoaded', function() {
            const errorContainer = document.querySelector('.error-container');
            
            // Add hover effect
            errorContainer.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.02)';
            });
            
            errorContainer.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
            });
            
            // Click effect
            errorContainer.addEventListener('click', function() {
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 150);
            });
        });
    </script>
</body>
</html>
`);
    }
});

// Admin - Edit Product (updated for base64 images)
app.get('/admin/editproduct/:id', async (req, res) => {
    if (!adminLoggedIn) return res.redirect('/login');
    
    const product = await Product.findById(req.params.id);
    if (!product) return res.send('Product not found');
    
    // Create data URLs for images to display them
    const mainImageSrc = `data:${product.mainImage.contentType};base64,${product.mainImage.data}`;
    const additionalImagesSrc = product.additionalImages.map(img => 
        `data:${img.contentType};base64,${img.data}`
    );
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Edit Product | Admin Panel</title>
            
            <!-- Bootstrap 5 CSS -->
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            
            <!-- Font Awesome -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            
            <!-- Animate.css -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
            
            <!-- Google Fonts -->
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@500;600;700&display=swap" rel="stylesheet">
            
            <!-- Custom CSS -->
            <style>
                :root {
                    --primary-color: #4e73df;
                    --secondary-color: #f8f9fc;
                    --accent-color: #2e59d9;
                    --success-color: #1cc88a;
                    --warning-color: #f6c23e;
                    --danger-color: #e74a3b;
                }
                
                body {
                    background-color: #f5f7fa;
                    font-family: 'Poppins', sans-serif;
                }
                
                .navbar-brand {
                    font-family: 'Montserrat', sans-serif;
                    font-weight: 700;
                    font-size: 1.5rem;
                }
                
                .edit-product-container {
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
                    padding: 2rem;
                    margin-bottom: 2rem;
                    animation: fadeInUp 0.5s ease-out;
                }
                
                .section-title {
                    font-family: 'Montserrat', sans-serif;
                    font-weight: 600;
                    color: #2c3e50;
                    margin: 2rem 0 1.5rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 2px solid var(--primary-color);
                    position: relative;
                }
                
                .section-title:after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: -2px;
                    width: 50px;
                    height: 3px;
                    background: var(--accent-color);
                }
                
                .form-label {
                    font-weight: 500;
                    color: #495057;
                }
                
                .form-control, .form-select {
                    border-radius: 8px;
                    padding: 0.75rem 1rem;
                    border: 1px solid #ced4da;
                    transition: all 0.3s ease;
                }
                
                .form-control:focus, .form-select:focus {
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 0.25rem rgba(78, 115, 223, 0.25);
                }
                
                .image-preview-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    margin: 15px 0;
                }
                
                .image-preview {
                    width: 100px;
                    height: 100px;
                    border-radius: 8px;
                    object-fit: cover;
                    border: 2px solid #eee;
                    transition: all 0.3s ease;
                }
                
                .image-preview:hover {
                    transform: scale(1.05);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                }
                
                .main-image-preview {
                    width: 200px;
                    height: 200px;
                    border: 3px solid var(--primary-color);
                }
                
                .btn-submit {
                    background: var(--primary-color);
                    border: none;
                    padding: 12px 30px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(78, 115, 223, 0.3);
                }
                
                .btn-submit:hover {
                    background: var(--accent-color);
                    transform: translateY(-3px);
                    box-shadow: 0 8px 20px rgba(78, 115, 223, 0.4);
                }
                
                .btn-back {
                    transition: all 0.3s ease;
                }
                
                .btn-back:hover {
                    transform: translateX(-5px);
                }
                
                /* Tag input styling */
                .tag-input-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    margin-top: 5px;
                }
                
                .tag-badge {
                    background: #e9ecef;
                    border-radius: 50px;
                    padding: 5px 10px;
                    font-size: 0.8rem;
                    display: inline-flex;
                    align-items: center;
                }
                
                /* Animation for form sections */
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .form-section {
                    animation: fadeInUp 0.5s ease-out;
                }
                
                /* Responsive adjustments */
                @media (max-width: 768px) {
                    .edit-product-container {
                        padding: 1.5rem;
                    }
                    
                    .section-title {
                        font-size: 1.3rem;
                    }
                    
                    .main-image-preview {
                        width: 150px;
                        height: 150px;
                    }
                }
                
                @media (max-width: 576px) {
                    .edit-product-container {
                        padding: 1rem;
                    }
                    
                    .form-control, .form-select {
                        padding: 0.6rem 0.8rem;
                    }
                }
            </style>
        </head>
        <body>
            <!-- Navigation -->
            <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm mb-4">
                <div class="container">
                    <a class="navbar-brand" href="/admin">
                        <i class="fas fa-crown me-2"></i>Admin Panel
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link" href="/admin/products">
                                    <i class="fas fa-boxes me-1"></i> Products
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/admin/orders">
                                    <i class="fas fa-shopping-bag me-1"></i> Orders
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/admin/logout">
                                    <i class="fas fa-sign-out-alt me-1"></i> Logout
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <!-- Main Content -->
            <div class="container mb-5">
                <div class="edit-product-container">
                    <h1 class="mb-4 text-center">
                        <i class="fas fa-edit me-2"></i>Edit Product
                    </h1>
                    
                    <form action="/admin/updateproduct/${product._id}" method="post" enctype="multipart/form-data">
                        <!-- Basic Product Information -->
                        <div class="form-section animate__animated animate__fadeInUp">
                            <h3 class="section-title">
                                <i class="fas fa-info-circle me-2"></i>Basic Information
                            </h3>
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label for="name" class="form-label">Product Name</label>
                                    <input type="text" class="form-control" id="name" name="name" value="${product.name}" required>
                                </div>
                                <div class="col-md-6">
                                    <label for="category" class="form-label">Category</label>
                                    <input type="text" class="form-control" id="category" name="category" value="${product.category}" required>
                                </div>
                                <div class="col-md-6">
                                    <label for="brand" class="form-label">Brand</label>
                                    <input type="text" class="form-control" id="brand" name="brand" value="${product.brand}" required>
                                </div>
                                <div class="col-md-6">
                                    <label for="sku" class="form-label">SKU/ID</label>
                                    <input type="text" class="form-control" id="sku" name="sku" value="${product.sku}" required>
                                </div>
                                <div class="col-md-6">
                                    <label for="productCode" class="form-label">Product Code</label>
                                    <input type="text" class="form-control" id="productCode" name="productCode" value="${product.productCode || ''}">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Pricing & Availability -->
                        <div class="form-section animate__animated animate__fadeInUp" style="animation-delay: 0.1s">
                            <h3 class="section-title">
                                <i class="fas fa-tag me-2"></i>Pricing & Availability
                            </h3>
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <label for="price" class="form-label">Price (₹)</label>
                                    <input type="number" step="0.01" class="form-control" id="price" name="price" value="${product.price}" required>
                                </div>
                                <div class="col-md-4">
                                    <label for="mrp" class="form-label">MRP (₹)</label>
                                    <input type="number" step="0.01" class="form-control" id="mrp" name="mrp" value="${product.mrp}" required>
                                </div>
                                <div class="col-md-4">
                                    <label for="discount" class="form-label">Discount (%)</label>
                                    <input type="number" step="0.01" class="form-control" id="discount" name="discount" value="${product.discount}" required>
                                </div>
                                <div class="col-md-4">
                                    <label for="stock" class="form-label">Stock Quantity</label>
                                    <input type="number" class="form-control" id="stock" name="stock" value="${product.stock}" required>
                                </div>
                                <div class="col-md-4">
                                    <label for="lowStockAlert" class="form-label">Low Stock Alert</label>
                                    <input type="number" class="form-control" id="lowStockAlert" name="lowStockAlert" value="${product.lowStockAlert || 0}">
                                </div>
                                <div class="col-md-4">
                                    <label for="deliveryCharge" class="form-label">Delivery Charge (₹)</label>
                                    <input type="number" step="0.01" class="form-control" id="deliveryCharge" name="deliveryCharge" value="${product.deliveryCharge || 0}">
                                </div>
                                <div class="col-12">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="freeDelivery" name="freeDelivery" ${product.freeDelivery ? 'checked' : ''}>
                                        <label class="form-check-label" for="freeDelivery">
                                            Free Delivery
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Product Variants -->
                        <div class="form-section animate__animated animate__fadeInUp" style="animation-delay: 0.2s">
                            <h3 class="section-title">
                                <i class="fas fa-list-alt me-2"></i>Product Variants
                            </h3>
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <label for="sizes" class="form-label">Available Sizes (comma separated)</label>
                                    <input type="text" class="form-control" id="sizes" name="sizes" value="${product.sizes.join(', ')}">
                                </div>
                                <div class="col-md-4">
                                    <label for="colors" class="form-label">Available Colors (comma separated)</label>
                                    <input type="text" class="form-control" id="colors" name="colors" value="${product.colors.join(', ')}">
                                </div>
                                <div class="col-md-4">
                                    <label for="variants" class="form-label">Other Variants (comma separated)</label>
                                    <input type="text" class="form-control" id="variants" name="variants" value="${product.variants.join(', ')}">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Images -->
                        <div class="form-section animate__animated animate__fadeInUp" style="animation-delay: 0.3s">
                            <h3 class="section-title">
                                <i class="fas fa-images me-2"></i>Product Images
                            </h3>
                            <div class="mb-3">
                                <label class="form-label">Current Main Image</label>
                                <div>
                                    <img src="${mainImageSrc}" class="main-image-preview rounded">
                                </div>
                                <label for="mainImage" class="form-label mt-3">Change Main Image</label>
                                <input class="form-control" type="file" id="mainImage" name="mainImage">
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Current Additional Images</label>
                                <div class="image-preview-container">
                                    ${additionalImagesSrc.map(src => `
                                        <img src="${src}" class="image-preview rounded">
                                    `).join('')}
                                </div>
                                <label for="additionalImages" class="form-label">Add More Images</label>
                                <input class="form-control" type="file" id="additionalImages" name="additionalImages" multiple>
                                <small class="text-muted">Hold Ctrl/Cmd to select multiple images</small>
                            </div>
                        </div>
                        
                        <!-- Description & Specifications -->
                        <div class="form-section animate__animated animate__fadeInUp" style="animation-delay: 0.4s">
                            <h3 class="section-title">
                                <i class="fas fa-align-left me-2"></i>Description & Specifications
                            </h3>
                            <div class="row g-3">
                                <div class="col-12">
                                    <label for="shortDescription" class="form-label">Short Description</label>
                                    <textarea class="form-control" id="shortDescription" name="shortDescription" rows="3" required>${product.shortDescription}</textarea>
                                </div>
                                <div class="col-12">
                                    <label for="fullDescription" class="form-label">Full Description</label>
                                    <textarea class="form-control" id="fullDescription" name="fullDescription" rows="5" required>${product.fullDescription}</textarea>
                                </div>
                                <div class="col-12">
                                    <label for="keyFeatures" class="form-label">Key Features (one per line)</label>
                                    <textarea class="form-control" id="keyFeatures" name="keyFeatures" rows="3" required>${product.keyFeatures.join('\n')}</textarea>
                                </div>
                                <div class="col-md-4">
                                    <label for="material" class="form-label">Material</label>
                                    <input type="text" class="form-control" id="material" name="material" value="${product.material || ''}">
                                </div>
                                <div class="col-md-4">
                                    <label for="dimensions" class="form-label">Dimensions</label>
                                    <input type="text" class="form-control" id="dimensions" name="dimensions" value="${product.dimensions || ''}">
                                </div>
                                <div class="col-md-4">
                                    <label for="weight" class="form-label">Weight</label>
                                    <input type="text" class="form-control" id="weight" name="weight" value="${product.weight || ''}">
                                </div>
                                <div class="col-12">
                                    <label for="warranty" class="form-label">Warranty Information</label>
                                    <input type="text" class="form-control" id="warranty" name="warranty" value="${product.warranty || ''}">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Additional Information -->
                        <div class="form-section animate__animated animate__fadeInUp" style="animation-delay: 0.5s">
                            <h3 class="section-title">
                                <i class="fas fa-info-circle me-2"></i>Additional Information
                            </h3>
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label for="tags" class="form-label">Tags (comma separated)</label>
                                    <input type="text" class="form-control" id="tags" name="tags" value="${product.tags.join(', ')}">
                                </div>
                                <div class="col-md-6">
                                    <label for="status" class="form-label">Product Status</label>
                                    <select class="form-select" id="status" name="status">
                                        <option value="Active" ${product.status === 'Active' ? 'selected' : ''}>Active</option>
                                        <option value="Inactive" ${product.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label for="launchDate" class="form-label">Launch Date</label>
                                    <input type="date" class="form-control" id="launchDate" name="launchDate" value="${product.launchDate ? product.launchDate.toISOString().split('T')[0] : ''}">
                                </div>
                                <div class="col-md-6">
                                    <label for="returnPolicy" class="form-label">Return Policy</label>
                                    <input type="text" class="form-control" id="returnPolicy" name="returnPolicy" value="${product.returnPolicy || ''}">
                                </div>
                                <div class="col-md-6">
                                    <label for="bankOffers" class="form-label">Bank Offers</label>
                                    <input type="text" class="form-control" id="bankOffers" name="bankOffers" value="${product.bankOffers || ''}">
                                </div>
                                <div class="col-md-6">
                                    <label for="specialOffer" class="form-label">Special Offer</label>
                                    <input type="text" class="form-control" id="specialOffer" name="specialOffer" value="${product.specialOffer || ''}">
                                </div>
                            </div>
                        </div>
                        
                        <div class="d-flex justify-content-between mt-5">
                            <a href="/admin/products" class="btn btn-outline-secondary btn-back">
                                <i class="fas fa-arrow-left me-1"></i> Back to Products
                            </a>
                            <button type="submit" class="btn btn-primary btn-submit">
                                <i class="fas fa-save me-1"></i> Update Product
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Bootstrap JS Bundle with Popper -->
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            
            <!-- Custom JS -->
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    // Initialize tooltips
                    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
                    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
                        return new bootstrap.Tooltip(tooltipTriggerEl);
                    });
                    
                    // Preview image when selected
                    document.getElementById('mainImage').addEventListener('change', function(e) {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = function(event) {
                                document.querySelector('.main-image-preview').src = event.target.result;
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                    
                    // Preview multiple images
                    document.getElementById('additionalImages').addEventListener('change', function(e) {
                        const files = e.target.files;
                        const previewContainer = document.querySelector('.image-preview-container');
                        
                        // Clear existing previews (except the current ones)
                        previewContainer.querySelectorAll('img:not(.image-preview)').forEach(img => img.remove());
                        
                        if (files) {
                            Array.from(files).forEach(file => {
                                const reader = new FileReader();
                                reader.onload = function(event) {
                                    const img = document.createElement('img');
                                    img.src = event.target.result;
                                    img.className = 'image-preview rounded';
                                    previewContainer.appendChild(img);
                                };
                                reader.readAsDataURL(file);
                            });
                        }
                    });
                });
            </script>
        </body>
        </html>
    `);
});
app.post('/admin/updateproduct/:id', upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 5 }
]), async (req, res) => {
    if (!adminLoggedIn) return res.redirect('/login');
    
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.send('Product not found');
        
        const {
            name, category, brand, sku, productCode,
            price, mrp, discount, stock, lowStockAlert, deliveryCharge, freeDelivery,
            sizes, colors, variants,
            shortDescription, fullDescription, keyFeatures, material, dimensions, weight, warranty,
            tags, status, launchDate, returnPolicy, bankOffers, specialOffer
        } = req.body;
        
        // Update product fields
        product.name = name;
        product.category = category;
        product.brand = brand;
        product.sku = sku;
        product.productCode = productCode;
        product.price = parseFloat(price);
        product.mrp = parseFloat(mrp);
        product.discount = parseFloat(discount);
        product.stock = parseInt(stock);
        product.lowStockAlert = lowStockAlert ? parseInt(lowStockAlert) : 0;
        product.deliveryCharge = parseFloat(deliveryCharge || 0);
        product.freeDelivery = freeDelivery === 'on';
        product.sizes = sizes ? sizes.split(',').map(s => s.trim()) : [];
        product.colors = colors ? colors.split(',').map(c => c.trim()) : [];
        product.variants = variants ? variants.split(',').map(v => v.trim()) : [];
        product.shortDescription = shortDescription;
        product.fullDescription = fullDescription;
        product.keyFeatures = keyFeatures.split(',').map(f => f.trim());
        product.material = material;
        product.dimensions = dimensions;
        product.weight = weight;
        product.warranty = warranty;
        product.tags = tags ? tags.split(',').map(t => t.trim()) : [];
        product.status = status || 'Active';
        product.launchDate = launchDate ? new Date(launchDate) : null;
        product.returnPolicy = returnPolicy;
        product.bankOffers = bankOffers;
        product.specialOffer = specialOffer;
        
        // Update images if new ones are uploaded
        if (req.files.mainImage) {
            product.mainImage = processUploadedFile(req.files.mainImage[0]);
        }
        if (req.files.additionalImages) {
            const newAdditionalImages = req.files.additionalImages.map(file => processUploadedFile(file));
            product.additionalImages = product.additionalImages.concat(newAdditionalImages);
        }
        
        await product.save();
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
       res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error Updating Product</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            margin: 0;
        }
        .error-card {
            background: white;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            padding: 2rem;
            text-align: center;
            max-width: 500px;
            width: 100%;
            animation: fadeIn 0.4s ease-out;
        }
        .error-icon {
            color: #dc3545;
            font-size: 3.5rem;
            margin-bottom: 1rem;
            animation: pulse 1.5s infinite;
        }
        .btn-back {
            background: #0d6efd;
            color: white;
            padding: 0.5rem 1.5rem;
            border-radius: 50px;
            text-decoration: none;
            display: inline-block;
            margin-top: 1.5rem;
            transition: all 0.3s;
            border: none;
        }
        .btn-back:hover {
            background: #0b5ed7;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(13, 110, 253, 0.3);
            color: white;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        @media (max-width: 576px) {
            .error-card {
                padding: 1.5rem;
            }
            .error-icon {
                font-size: 2.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="error-card">
        <div class="error-icon">
            <i class="fas fa-exclamation-circle"></i>
        </div>
        <h2 class="mb-3">Error Updating Product</h2>
        <p class="text-muted">Something went wrong while updating the product. Please try again.</p>
        <a href="/admin/products" class="btn btn-back">
            <i class="fas fa-arrow-left me-2"></i>Back to Products
        </a>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
`);
    }
});

// Admin - Delete Product (unchanged)
app.get('/admin/deleteproduct/:id', async (req, res) => {
    if (!adminLoggedIn) return res.redirect('/login');
    
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.send('Error deleting product. <a href="/admin/products">Back to products</a>');
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});