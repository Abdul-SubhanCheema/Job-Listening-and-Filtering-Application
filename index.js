const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const User = require('./model/user.js')
const app = express();
const bodyParser = require('body-parser');
const path = require('path');
const { log } = require('console');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
require("dotenv").config();
app.use(express.static('public'));

function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send("Token is missing");
    }

    jwt.verify(token, process.env.TOKEN_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).send("Invalid token");
        }

        req.user = decoded;
        next();
    });
}
function verifytoken(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send("Token is missing");
    }

    jwt.verify(token, process.env.TOKEN_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).send("Invalid token");
        }

        req.user = decoded;
        next();
    });
}
app.get('/selection', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/choice.html'));
});

app.post('/userregister', async (req, res) => {
    const { username, email, password } = req.body;
    if (!(email && username && password)) {
        res.send("All field not filled");
    }
    const oldUser = await User.findOne({ email });
    if (oldUser) {
        res.send("user exist");
        return;
    }
    const totalUsers = await User.countDocuments({});
    const user = await User.create({
        userid: totalUsers + 1,
        name: username,
        email: email,
        password: password,
    });

    await user.save();
    // res.sendFile(path.join(__dirname + '/public/User_login.html'));
    res.status(400).send(user);
});
app.post("/userlogin", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!(email && password && username)) {
            res.status(400).send("All input is required");
            return;
        }
        var token;
        const user = await User.findOne({ email });
        if (user) {
            if (user.canlogin) {
                const token = jwt.sign(
                    { username, password, email },
                    process.env.TOKEN_KEY,
                    {
                        expiresIn: "2h",
                    }
                );
                res.cookie('token', token, { httpOnly: true, secure: false });
                res.send('Login Successfully');
            } else {
                res.status(403).send('You are blocked by admin');
            }
        } else {
            res.status(400).send('Invalid Credentials');
        }

    } catch (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
    }
});
// Get posts from users the current user is following (protected by authentication middleware)
app.get('/userhome', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            res.status(404).send("User not found");
            return;
        }

        let { page = 1, pageSize = 10 } = req.body;

        // Validate pageSize to ensure it's a positive number
        pageSize = Math.max(1, parseInt(pageSize));

        // Calculate the starting index based on the page and pageSize
        const startIndex = (page - 1) * pageSize;

        // Retrieve a subset of following users with pagination
        const followingSubset = user.following.slice(startIndex, startIndex + pageSize);

        // Retrieve detailed information about the subset of following users
        const followingPosts = await User.find({ userid: { $in: followingSubset } })
            .select('userid name email posts')
            .populate({
                path: 'posts',
            })
            .exec();

        // Extract posts from all users within the provided limit
        const posts = followingPosts.flatMap(followingUser => {
            const filteredPosts = followingUser.posts.filter(post => post.canshow !== false);
            return filteredPosts.map(post => ({
                userid: followingUser.userid,
                username: followingUser.name,
                useremail: followingUser.email,
                postDetails: post.toObject(),
            }));
        });

        res.status(200).json(posts);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/userhome/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ Username: user.name, Email: user.email, Password: user.password });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

app.put('/userhome/profile', authenticateToken, async (req, res) => {
    const { username, email, password } = req.body;
    const userEmail = req.user.email;

    try {
        // Check if the updated email already exists in the database
        const oldUser = await User.findOne({ email });
        if (oldUser && oldUser.email !== userEmail) {
            return res.status(400).json({ error: 'Try another Email to Update Profile' });
        }

        // If email is unique, proceed to update the user profile
        const updatedUser = await User.findOne({ email: userEmail });

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update the fields individually
        if (username) {
            updatedUser.name = username;
        }
        if (email) {
            updatedUser.email = email;
        }
        if (password) {
            updatedUser.password = password;
        }

        // Save the updated user
        await updatedUser.save();
        const token = jwt.sign(
            { username: updatedUser.name, email: updatedUser.email, name: updatedUser.name, /* other user information */ },
            process.env.TOKEN_KEY,
            { expiresIn: "2h" }
        );
        res.cookie('token', token, { httpOnly: true, secure: false });
        // Fetch the updated user from the database again
        const updatedUserAfterSave = await User.findOne({ email: updatedUser.email });

        res.status(200).json({ message: 'Profile updated successfully', profile: updatedUserAfterSave });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/userhome/post', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            res.status(400).send("Content is required for a post");
            return;
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            res.status(404).send("User not found");
            return;
        }

        const newPost = {
            postid: user.posts.length + 1,
            content,
            likes: 0,
            comments: []
        };

        user.posts.push(newPost);
        await user.save();

        res.status(201).send(`Post added for user ${user.userid}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});
app.get('/userhome/posts', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            res.status(404).send("User not found");
            return;
        }

        res.status(200).json(user.posts);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});
app.put('/userhome/post/:postid', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;
        const { postid } = req.params;

        if (!content) {
            res.status(400).send("Content is required for updating a post");
            return;
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            res.status(404).send("User not found");
            return;
        }

        const postToUpdate = user.posts.find(post => post.postid === parseInt(postid));

        if (!postToUpdate) {
            res.status(404).send("Post not found");
            return;
        }

        postToUpdate.content = content;
        await user.save();

        res.status(200).send(`Post updated for user ${user.userid}, Post ID: ${postToUpdate.postid}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});
app.delete('/userhome/post/:postid', authenticateToken, async (req, res) => {
    try {
        const { postid } = req.params;

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            res.status(404).send("User not found");
            return;
        }

        const postIndexToDelete = user.posts.findIndex(post => post.postid === parseInt(postid));

        if (postIndexToDelete === -1) {
            res.status(404).send("Post not found");
            return;
        }

        user.posts.splice(postIndexToDelete, 1);
        await user.save();
        res.status(200).send(`Post deleted for user ${user.userid}, Post ID: ${postid}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/userhome/follow/:userid', authenticateToken, async (req, res) => {
    try {
        const { userid } = req.params;

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            res.status(404).send("User not found");
            return;
        }

        const userToFollow = await User.findOne({ userid: parseInt(userid) });
        if (!userToFollow) {
            res.status(404).send("User to follow not found");
            return;
        }

        // Check if the user is trying to follow themselves
        if (user.userid === userToFollow.userid) {
            res.status(400).send("You cannot follow yourself");
            return;
        }

        // Check if the user is already following the target user
        if (user.following.includes(userToFollow.userid)) {
            res.status(400).send("You are already following this user");
            return;
        }

        user.following.push(userToFollow.userid);
        userToFollow.followers.push(user.userid);
        userToFollow.Notification_followers.push("User with id " + user.userid + " follow you");
        await user.save();
        await userToFollow.save();

        res.status(200).send(`You are now following user ${userToFollow.userid}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});
// Unfollow another user (protected by authentication middleware)
app.delete('/userhome/follow/:userid', authenticateToken, async (req, res) => {
    try {
        const { userid } = req.params;

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            res.status(404).send("User not found");
            return;
        }

        const userToUnfollow = await User.findOne({ userid: parseInt(userid) });
        if (!userToUnfollow) {
            res.status(404).send("User to unfollow not found");
            return;
        }

        // Check if the user is trying to unfollow themselves
        if (user.userid === userToUnfollow.userid) {
            res.status(400).send("You cannot unfollow yourself");
            return;
        }

        // Check if the user is already not following the target user
        if (!user.following.includes(userToUnfollow.userid)) {
            res.status(400).send("You are not following this user");
            return;
        }

        // Remove the target user from the current user's following array
        user.following = user.following.filter(followedUserId => followedUserId !== userToUnfollow.userid);

        // Remove the current user from the target user's followers array
        userToUnfollow.followers = userToUnfollow.followers.filter(followerUserId => followerUserId !== user.userid);

        await user.save();
        await userToUnfollow.save();

        res.status(200).send(`You have unfollowed user ${userToUnfollow.userid}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/userhome/like/:userid/:postid', authenticateToken, async (req, res) => {
    const followuser = req.params.userid;
    const followuserpost = req.params.postid;

    try {
        const user = await User.findOne({ email: req.user.email });
        const currentuserid = user.userid;
        if (!user) {
            res.status(404).send("User not found");
            return;
        }

        const isFollowing = user.following.includes(followuser);
        if (!isFollowing) {
            return res.status(403).json({ error: 'You can only like posts of users you are following' });
        }

        const userToFollow = await User.findOne({ userid: parseInt(followuser) });
        if (!userToFollow) {
            res.status(404).send("User whose post to be liked not found");
            return;
        }

        const postToUpdate = userToFollow.posts.find(post => post.postid === parseInt(followuserpost));
        if (!postToUpdate) {
            res.status(404).send("Post id not found in followed user");
            return;
        }
        if (!(postToUpdate.canshow)) {
            return res.send("Post is disabled");
        }


        // Ensure that likes and likerid are defined
        if (!postToUpdate.likes || !postToUpdate.likes.likerid) {
            postToUpdate.likes = { likerid: [], totalLikes: 0 };
        }

        // Check if the likerid is already in the likes array
        const alreadyLiked = postToUpdate.likes.likerid.includes(parseInt(currentuserid));
        if (alreadyLiked) {
            return res.status(400).json({ error: 'You have already liked this post' });
        } else {
            // Add the likerid to the likes array
            postToUpdate.likes.likerid.push(parseInt(currentuserid));
            postToUpdate.likes.totalLikes++;

            await userToFollow.save();

            // Convert the post to a plain object to avoid validation issues
            const plainPost = postToUpdate.toObject();

            return res.status(200).json({ message: 'Post liked successfully' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
app.delete('/userhome/like/:userid/:postid', authenticateToken, async (req, res) => {
    const unfollowuser = req.params.userid;
    const unfollowuserpost = req.params.postid;

    try {
        const user = await User.findOne({ email: req.user.email });
        const currentuserid = user.userid;
        if (!user) {
            res.status(404).send("User not found");
            return;
        }

        const isFollowing = user.following.includes(unfollowuser);
        if (!isFollowing) {
            return res.status(403).json({ error: 'You can only unlike posts of users you are following' });
        }

        const userToUnfollow = await User.findOne({ userid: parseInt(unfollowuser) });
        if (!userToUnfollow) {
            res.status(404).send("User whose post to be unliked not found");
            return;
        }

        const postToUpdate = userToUnfollow.posts.find(post => post.postid === parseInt(unfollowuserpost));
        if (!postToUpdate) {
            res.status(404).send("Post id not found in unfollowed user");
            return;
        }
        if (!(postToUpdate.canshow)) {
            return res.send("Post is disabled");
        }

        // Ensure that likes and likerid are defined
        if (!postToUpdate.likes || !postToUpdate.likes.likerid) {
            postToUpdate.likes = { likerid: [], totalLikes: 0 };
        }

        // Check if the likerid is in the likes array
        const likedIndex = postToUpdate.likes.likerid.indexOf(parseInt(currentuserid));
        if (likedIndex === -1) {
            return res.status(400).json({ error: 'You have not liked this post' });
        } else {
            // Remove the likerid from the likes array
            postToUpdate.likes.likerid.splice(likedIndex, 1);
            postToUpdate.likes.totalLikes--;
            await userToUnfollow.save();

            // Convert the post to a plain object to avoid validation issues
            const plainPost = postToUpdate.toObject();

            return res.status(200).json({ message: 'Post unliked successfully' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/userhome/comment/:userid/:postid', authenticateToken, async (req, res) => {

    const userToFollowId = req.params.userid;
    const postId = req.params.postid;
    const commentText = req.body.commentText;  // Assuming you have the comment text in the request body
    try {
        const user = await User.findOne({ email: req.user.email });
        const commenterId = user.userid;
        if (!user) {
            res.status(404).send("User not found");
            return;
        }
        const isFollowing = user.following.includes(userToFollowId);
        if (!isFollowing) {
            return res.status(403).json({ error: 'You can only comment on posts of users you are following' });
        }
        const userToCommentOn = await User.findOne({ userid: parseInt(userToFollowId) });
        if (!userToCommentOn) {
            res.status(404).send("User whose post to be commented on not found");
            return;
        }
        const postToCommentOn = userToCommentOn.posts.find(post => post.postid === parseInt(postId));
        if (!postToCommentOn) {
            res.status(404).send("Post id not found in followed user");
            return;
        }
        if (!(postToCommentOn.canshow)) {
            res.status(404).send("Post is disabled");
            return;
        }

        const newComment = {
            commenters: commenterId,
            text: commentText,
            commentid: postToCommentOn.comments.length + 1, // Assuming commentid is unique, increment for each new comment
        };
        const newnotificationcomment = "User with id " + commenterId + " comment on your post";
        postToCommentOn.comments.push(newComment);
        userToCommentOn.Notification_comments.push(newnotificationcomment);
        // Save the changes
        await userToCommentOn.save();

        // Return a success message
        return res.status(200).json({ message: 'Comment added successfully', newComment });


    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.delete('/userhome/comment/:userid/:postid/:commentid', authenticateToken, async (req, res) => {
    const userToFollowId = req.params.userid;
    const postId = req.params.postid;
    const commentIdToDelete = req.params.commentid;

    try {
        const user = await User.findOne({ email: req.user.email });
        const commenterId = user.userid;

        if (!user) {
            res.status(404).send("User not found");
            return;
        }

        const isFollowing = user.following.includes(userToFollowId);

        if (!isFollowing) {
            return res.status(403).json({ error: 'You can only delete comments on posts of users you are following' });
        }

        const userToCommentOn = await User.findOne({ userid: parseInt(userToFollowId) });

        if (!userToCommentOn) {
            res.status(404).send("User whose post to be commented on not found");
            return;
        }

        const postToCommentOn = userToCommentOn.posts.find(post => post.postid === parseInt(postId));

        if (!postToCommentOn) {
            res.status(404).send("Post id not found in followed user");
            return;
        }
        if (!(postToCommentOn.canshow)) {
            res.status(404).send("Post is disabled");
            return;
        }

        const commentToDelete = postToCommentOn.comments.find(comment => comment.commentid === parseInt(commentIdToDelete));

        if (!commentToDelete) {
            return res.status(404).json({ message: 'Comment not found on the specified post' });
        }

        // Check if the comment was made by the current user
        if (commentToDelete.commenters !== commenterId) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }

        // Remove the comment from the array
        postToCommentOn.comments = postToCommentOn.comments.filter(comment => comment.commentid !== parseInt(commentIdToDelete));

        // Save the changes
        await userToCommentOn.save();

        // Return a success message
        return res.status(200).json({ message: 'Comment deleted successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/userhome/viewnotifications', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });

        if (!user) {
            return res.status(404).send("User not found");
        }

        let notifications = {};
        console.log(user.Notification_comments);
        // Handle comments notifications
        if (user && user.Notification_comments) {
            if (user.Notification_comments.length < 1) {
                notifications.comments = "No one commented on your post yet";
            } else {
                notifications.comments = user.Notification_comments;
                user.Notification_comments = []; // Empty the comments array
            }
        }

        // Handle followers notifications
        if (user && user.Notification_followers) {
            if (user.Notification_followers.length < 1) {
                notifications.followers = "No one followed you yet";
            } else {
                notifications.followers = user.Notification_followers;
                user.Notification_followers = []; // Empty the followers array
            }
        }

        // Save the user instance with the modified arrays
        await user.save();

        res.json(notifications);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/userhome/search/keywords', authenticateToken, async (req, res) => {
    try {
        const { keywords } = req.body; // Remove .keywords
        console.log(keywords);

        if (!keywords) {
            return res.status(400).json({ error: 'Keywords are required for search' });
        }

        // Find all users
        const users = await User.find();

        // Find posts that contain the specified keywords for each user
        const matchingPosts = users.reduce((result, user) => {
            const userMatchingPosts = user.posts.filter(post => post.content.includes(keywords));
            return result.concat(userMatchingPosts);
        }, []);

        res.status(200).json({ matchingPosts });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/userhome/search/username', authenticateToken, async (req, res) => {
    try {
        const username = req.body.username;

        // Find all users with the given username
        const users = await User.find({ name: username });

        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'No users found with the given username' });
        }

        // Return all posts of the users
        const allUserPosts = [];
        for (const user of users) {
            const userPosts = user.posts.map(post => ({
                userid: user.userid,
                postid: post.postid,
                content: post.content,
                likes: post.likes,
                comments: post.comments
            }));
            allUserPosts.push(...userPosts);
        }

        res.status(200).json({ allUserPosts });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
app.post("/adminlogin", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!(email && password && username)) {
            return res.status(400).send("All input is required");
        }
        if (username == 'AbdulSubhan' && email == 'i211223@nu.edu.pk' && password == '1223') {
            const token = jwt.sign(
                { username, password, email },
                process.env.TOKEN_KEY,
                {
                    expiresIn: "2h",
                }
            );

            res.cookie('token', token, { httpOnly: true, secure: false });

            return res.json("login Success");
        }
        return res.status(400).send("Invalid Credentials");
    } catch (err) {
        console.log(err);
    }
});

app.get('/adminhome', verifytoken, async (req, res) => {

    try {
        const users = await User.find({}, 'userid name email password');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/adminhome/profile', verifytoken, async (req, res) => {

    const { username, email, password } = req.user;
    res.status(200).json({ username: username, email: email, password: password });
});

app.get('/adminhome/viewposts', verifytoken, async (req, res) => {
    try {
        const users = await User.find({}, 'name posts');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }

});
app.post("/adminhome/block/:userid", verifytoken, async (req, res) => {
    try {
        const usertoblock = req.params.userid;
        const user = await User.findOne({ userid: usertoblock });
        if (!user) {
            return res.status(404).send("User not found");
        }
        else {
            if (!(user.canlogin)) {
                return res.send("user is already blocked")
            }
            user.canlogin = false;
            await user.save();
            res.json(user)
        }
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});
app.post("/adminhome/unblock/:userid", verifytoken, async (req, res) => {
    try {
        const usertoblock = req.params.userid;
        const user = await User.findOne({ userid: usertoblock });
        if (!user) {
            return res.status(404).send("User not found");
        }
        else {
            if (user.canlogin) {
                return res.send("user is already unblocked")
            }
            user.canlogin = true;
            await user.save();
            res.json(user)
        }
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});
app.post('/adminhome/disable/:userid/:postid', verifytoken, async (req, res) => {
    try {
        const userID = req.params.userid;
        const postId = req.params.postid;

        const user = await User.findOne({ userid: userID });
        if (!user) {
            return res.status(404).send("User not found");
        }

        const postToDisable = user.posts.find(post => post.postid === parseInt(postId));
        if (!postToDisable) {
            res.status(404).send("Specific Post Not Found Against User");
            return;
        } else {
            if (!(postToDisable.canshow)) {
                return res.send("post is already disable")
            }
            postToDisable.canshow = false; // Corrected the typo in false
            await user.save();
            res.send("post disabled");
        }

    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }
});
app.post('/adminhome/enable/:userid/:postid', verifytoken, async (req, res) => {
    try {
        const userID = req.params.userid;
        const postId = req.params.postid;

        const user = await User.findOne({ userid: userID });
        if (!user) {
            return res.status(404).send("User not found");
        }

        const postToDisable = user.posts.find(post => post.postid === parseInt(postId));
        if (!postToDisable) {
            res.status(404).send("Specific Post Not Found Against User");
            return;
        } else {
            if (postToDisable.canshow) {
                return res.send("post is already enabled")
            }
            postToDisable.canshow = true; // Corrected the typo in false
            await user.save();
            res.send("post enabled");
        }

    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }
});

app.get('/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.send(users);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});



app.delete('/users', async (req, res) => {
    try {
        const result = await User.deleteMany({});
        res.json({ message: 'All users deleted successfully', deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while deleting users' });
    }
});


mongoose.connect("mongodb://localhost/Assignment_02", { useNewUrlParser: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('Database connected successfully');
});


app.listen(80, () => {
    console.log('App runing on port 80');
})