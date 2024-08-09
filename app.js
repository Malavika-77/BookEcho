const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv'); 
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const Review = require('./models/Review');

dotenv.config();

// Initialize the app
const app = express();

// Use environment variables for sensitive information
const JWT_SECRET = process.env.JWT_SECRET || 'bookreview';

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://projectsworks05:Lo7wlbEs3Z3QX7J4@projects.y2u4n.mongodb.net/?retryWrites=true&w=majority&appName=projects', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define User schema and model
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const photoSchema = new mongoose.Schema({
    photoUrl: String,
    likes: { type: Number, default: 0 }
});

const Photo = mongoose.model('Photo', photoSchema);


// Set up Handlebars
const { engine } = require('express-handlebars');
app.engine('hbs', engine({
    defaultLayout: 'main',
    extname: '.hbs',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(cors()); // CORS
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); // This line is crucial

app.use(express.json());

// Middleware to check if the user is logged in
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.redirect('/login'); // Redirect to login if not authenticated

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.redirect('/login');
        req.user = user;
        next();
    });
};

// Home route
app.get('/', (req, res) => {
    const token = req.cookies.token;
    const login = !!token; // Check if there is a token
    res.render('home', { title: 'Home', isLoggedIn: login });
});

// Home route
app.get('/', (req, res) => {
    const token = req.cookies.token;
    const login = !!token; // Check if there is a token
    res.render('home', { title: 'Home', isLoggedIn: login });
});

app.get('/login', (req, res) => {
    res.render('authen/login', {
        layout: 'main',
        hidehomeLink: true
    });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).send('Email does not exist.');
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid password.');
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, maxAge: 3600000 }); // 1 hour
        console.log('Login successful.');
        res.redirect('/');
    } catch (error) {
        res.status(500).send('Server error.');
    }
});

app.get('/signup', (req, res) => {
    res.render('authen/register', {
        layout: 'main',
        hidehomeLink: true
    });
});

app.post('/signup', async (req, res) => {
    const { email, password, confirmPassword } = req.body;

    const passwordRegex = /^(?=.*\d)(?=.*[A-Z]).{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).send('Password must be at least 8 characters long, contain at least one uppercase letter, and at least one digit.');
    }

    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match.');
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send('Email already in use.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            email,
            password: hashedPassword
        });

        await newUser.save();
        console.log('User registered successfully.');
        res.redirect('/login');
    } catch (error) {
        res.status(500).send('Server error.');
    }
});

app.use((req, res, next) => {
    // Check if there is a token
    const token = req.cookies.token;
    res.locals.isLoggedIn = !!token; // Pass isLoggedIn status to views
    next();
});

// Example of a protected route
app.get('/protected', authenticateToken, (req, res) => {
    res.send('This is a protected route.');
});

// Sign out route
app.get('/logout', (req, res) => {
    res.clearCookie('token'); // Clear the cookie
    res.redirect('/'); // Redirect to the login page
});


// PUT route to update review
app.put('/reviews/:title', async (req, res) => {
    const reviewTitle = req.params.title;
    const { content, imgUrl, rating } = req.body;
  
    try {
      const review = await Review.findOneAndUpdate(
        { title: reviewTitle },
        { content, imgUrl, rating },
        { new: true } // Return the updated document
      );
  
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }
  
      res.status(200).json({ message: 'Review updated successfully', review });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error updating review' });
    }
  });

  app.get('/reviews', async (req, res) => {
    try {
        const reviews = await Review.find().sort({ createdAt: -1 });
        res.json(reviews); // This should return JSON data
    } catch (err) {
        console.error('Error fetching reviews:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/reviews', async (req, res) => {
    try {
      // Create a new review instance with the data from the request body
      const newReview = new Review({
        title: req.body.title,
        content: req.body.content,
        rating: req.body.rating,
        imgUrl: req.body.imgUrl
      });
  
      // Save the review to the database
      await newReview.save();
  
      res.redirect('/');
     
    } catch (err) {
      console.error('Error adding review:', err);
      res.status(500).send('Internal Server Error');
    }
  });
  



app.put('/reviews/:title', async (req, res) => {
    const reviewTitle = req.params.title;
    const { content, imgUrl, rating } = req.body;
  
    try {
      // Find the review by title and update it
      const review = await Review.findOneAndUpdate(
        { title: reviewTitle }, // Find review by title
        { content, imgUrl, rating },
        { new: true } // Return the updated document
      );
  
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }
  
      res.status(200).json({ message: 'Review updated successfully', review });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error updating review' });
    }
  });
  
  app.delete('/reviews/:title', async (req, res) => {
    const reviewTitle = req.params.title;

    try {
        // Find the review by title and delete it
        const review = await Review.findOneAndDelete({ title: reviewTitle });

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        res.status(200).json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting review' });
    }
});

app.post('/add-photo', async (req, res) => {
    try {
        console.log('Received data:', req.body); // Debug log

        const { photoUrl } = req.body;

        if (!photoUrl) {
            return res.status(400).json({ success: false, message: 'Photo URL is required' });
        }

        // Create and save the photo
        const newPhoto = new Photo({ photoUrl, likes: 0 });
        await newPhoto.save();

        res.json({ success: true, photo: newPhoto });
    } catch (error) {
        console.error('Error adding photo:', error);
        res.status(500).json({ success: false, message: 'Error adding photo' });
    }
});

app.post('/like-photo/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const photo = await Photo.findById(id);
        if (!photo) {
            return res.status(404).json({ success: false, message: 'Photo not found' });
        }

        photo.likes += 1;
        await photo.save();

        res.json({ success: true, likes: photo.likes });
    } catch (error) {
        console.error('Error liking photo:', error);
        res.status(500).json({ success: false, message: 'Error liking photo' });
    }
});

app.get('/photos', async (req, res) => {
    try {
        const photos = await Photo.find().sort({ likes: 1 }); // Sort by likes descending
        res.json({ photos });
    } catch (error) {
        console.error('Error fetching photos:', error);
        res.status(500).json({ message: 'Error fetching photos' });
    }
});



// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
