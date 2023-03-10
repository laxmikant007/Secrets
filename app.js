//jshint esversion:6
require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

// const md5 = require('md5');
// const encrypt = require('mongoose-encryption')



const app = express();

// console.log(process.env.SECRET);

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: 'Our little secret.',
    resave: false,
    saveUninitialized: false,
    // cookie: { secure: true }
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose
    .connect(process.env.MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("DB Connetion Successfull");
    })
    .catch((err) => {
        console.log(err.message);
    });

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);




// userSchema.plugin(encrypt, { secret: process.env.SECRET, encryptedFields: ["password"] });

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, {
            id: user.id,
            username: user.username,
            picture: user.picture
        });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    // callbackURL: "http://localhost:3000/auth/google/secrets",
    callbackURL: "/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));




app.get("/", function (req, res) {
    res.render("home")
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ["profile"] }));

app.get('/auth/google/secrets',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect('/secrets');
    });

app.get("/login", function (req, res) {
    res.render("login")
});

app.get("/register", function (req, res) {
    res.render("register")
});



app.get("/secrets", function (req, res) {
    // if (req.isAuthenticated()) {
    //     res.render("secrets");
    // } else {
    //     res.redirect("/login")
    // }

    User.find({ "secret": { $ne: null } }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) {
                res.render("secrets", { usersWithSecrets: foundUsers });
            }
        }
    });
});

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login")
    }
});


app.post("/submit", function (req, res) {
    const submittedSecret = req.body.secret;


    console.log(req.user.id);

    User.findById(req.user.id, function (err, foundUser) {
        if (err) {
            console.log(err);

        } else {
            if (foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(function () {
                    res.redirect("/secrets");

                });

            }
        }
    });



});

// app.get("/logout", function (req, res) {
//     req.logout();
//     res.redirect("/");
// });
app.get('/logout', function (req, res, next) {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.post("/register", function (req, res) {

    // bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
    //     const newUser = new User({
    //         email: req.body.username,
    //         password: hash
    //     });

    //     newUser.save(function (err) {
    //         if (err) {
    //             console.log(err);
    //         }
    //         else {
    //             res.render("secrets");
    //         }
    //     });
    // })

    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    });

});

app.post("/login", function (req, res) {
    // const username = req.body.username;
    // const password = req.body.password;


    // User.findOne({ email: username }, function (err, foundUser) {
    //     if (err) {
    //         console.log(err);
    //     }
    //     else {
    //         if (foundUser) {

    //             bcrypt.compare(password, foundUser.password, function (err, result) {
    //                 if (result === true) {
    //                     res.render("secrets");
    //                 }
    //             })




    //         }
    //     }
    // });

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }

    });



});






// app.listen(3000, function () {
//     console.log("Server is running on port 3000!!!");
// })

const PORT = process.env.PORT || 3000;

app.listen(PORT, function () {
    console.log(`Server is running on port ${PORT}!!!`);
})

// if (process.env.NODE_ENV === 'production') {
//     app.use(express.static('build'));

// }