if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const { MongoStore } = require('connect-mongo');

const express = require('express'),
    session = require('express-session'),
    flash = require('connect-flash'), 
    ejsMate = require('ejs-mate'),
    methodOverride = require('method-override'),
    mongoose = require('mongoose'),
    path = require('path'),
    passport = require('passport'),
    localStrategy = require('passport-local'),
    helmet = require('helmet'),
    mongoSanitize = require('express-mongo-sanitize'),
    MongoDBStore = require('connect-mongo')(session),
    ExpressError = require('./utils/ExpressError'),
    app = express(),
    campgroundRoutes = require('./routes/campgrounds'),
    reviewRoutes = require('./routes/reviews'),
    userRoutes = require('./routes/users');    
    User = require('./models/user'),
    dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/yelpcamp';

// Code connecting to mongodb
mongoose.connect(dbUrl, 
{
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
})
.then(() => {
        console.log('Connection open!')
})
.catch(err => {
        console.log('Error in connecting...')
        console.log(err)
});     

// EJS & path setup
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Set default path for views to '/views'

// Middleware
app.use(express.urlencoded({extended: true}));
app.use(methodOverride('_method')); // Enable method overriding for PUT and DELETE requests
app.use(express.static(path.join(__dirname, 'public'))); // Prep static assets at public
app.use(mongoSanitize()); // Sanitize inputs to prevent SQL injections

const secret = process.env.SECRET || 'replacewithbettersecret'

const store = new MongoDBStore({ // Mongo store to store our sessions
    url: dbUrl,
    secret,
    touchAfter: 24 * 3600, // To ensure we don't resave our sessions whenever user refreshes page; resaves after 24 * 3600s
});

store.on('error', function (e) {
    console.log('Session Store error', e)
}); // Log errors

const sessionConfig = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: true, 
    cookie: {
        httpOnly: true, // For security measures; sessions only accessible through HTTP
        // secure: true,
        expires: Date.now() * 1000 * 60 * 60 * 24 * 7, // Set cookie to expire in a week (time is in ms)
        maxAge: 1000 * 60 * 60 * 24 * 7,
    },
} // Options for session setup

app.use(session(sessionConfig));
app.use(flash());

// Permitted URLs to obtain content from
const scriptSrcUrls = [
    "https://stackpath.bootstrapcdn.com/",
    "https://api.tiles.mapbox.com/",
    "https://api.mapbox.com/",
    "https://kit.fontawesome.com/",
    "https://cdnjs.cloudflare.com/",
    "https://cdn.jsdelivr.net",
];
const styleSrcUrls = [
    "https://kit-free.fontawesome.com/",
    "https://stackpath.bootstrapcdn.com/",
    "https://api.mapbox.com/",
    "https://api.tiles.mapbox.com/",
    "https://fonts.googleapis.com/",
    "https://use.fontawesome.com/",
];
const connectSrcUrls = [
    "https://api.mapbox.com/",
    "https://a.tiles.mapbox.com/",
    "https://b.tiles.mapbox.com/",
    "https://events.mapbox.com/",
];

const fontSrcUrls = [];

// Sets various HTTP headers to secure our app from stuff like clickjacking
app.use(
    helmet.contentSecurityPolicy({ // Define CSP to define permitted URLs to retrieve data from
        directives: {
            defaultSrc: [],
            connectSrc: ["'self'", ...connectSrcUrls],
            scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
            styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
            workerSrc: ["'self'", "blob:"],
            objectSrc: [],
            imgSrc: [
                "'self'",
                "blob:",
                "data:",
                `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`, //SHOULD MATCH YOUR CLOUDINARY ACCOUNT! 
                "https://images.unsplash.com/",
            ],
            fontSrc: ["'self'", ...fontSrcUrls],
        },
    })
);
app.use(passport.initialize());
app.use(passport.session()); // Enables persistent login sessions
passport.use(new localStrategy(User.authenticate())); // Local strategy method is to use authenticate() method from User
// authenticate() is already generated by passportLocalMongoose plugin
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
// serializeUser() and deserializeUser() are already added by passportLocalMongoose to User

// Flash middleware
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.use('/campgrounds', campgroundRoutes);
app.use('/campgrounds/:id/reviews', reviewRoutes);
app.use('/', userRoutes);

// 404 page
app.all('*', (req, res, next) => {
    next(new ExpressError('Page Not Found', 404))
})

// Default error handler
app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).render('error', { err });
 })

app.listen(3000, () => (console.log('Server listening on port 3000')));