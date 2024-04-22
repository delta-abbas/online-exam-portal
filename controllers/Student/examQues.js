const nodemailer = require('nodemailer');
const Exam = require("../../models/exam.js");
const questions = require("../../models/questions.js");
const user = require("../../models/users.js")
const StudentPerformance = require("../../models/records.js");
const EnrollmentRequest = require("../../models/examenrollment.js");
const Reviews = require("../../models/reviews.js")



module.exports.showExams = async(req,res)=>{
    try {
        const exam = await Exam.find();
        res.render("student/displayexam.ejs",{exam})
    }catch(error){
        console.error("Error:", error);
        res.render("templates/internalerror.ejs")
    }
}


module.exports.requestEnrollment = async(req,res)=>{
    try {
        const userid = req.user._id;
        const userName = req.user.username
        const {examid} = req.params;
        const exam = await Exam.findById(examid);
        const examName = exam.examName;
        const enddate = exam.end_date;
        const userdetails = await user.findById(userid);
        const userEmail = userdetails.email;

        const enrollment = new EnrollmentRequest ({
            studentId : userid,
            examId : examid,
            examname : examName,
            student : userName,
            lastdate : enddate
        });
        await enrollment.save();
       
         await Exam.findByIdAndUpdate(examid, { $push: { enrolled: enrollment._id } });
         await user.findByIdAndUpdate(userid, { $push: { enrolled: enrollment._id } });
         req.flash("success","your are Enrollment was successfull");
                //sending mail 
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.MAIL_USER,
                        pass: process.env.MAIL_PASSWORD
                    }
                });
        
                // Send email
                const info = await transporter.sendMail({
                    from: userEmail,
                    to: process.env.MAIL_USER,
                    subject: 'New enrollment request for the exam',
                    text: 'A new enrollment request for the exam is available.',
                    html: `
                        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                            <div style="background-color: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                                <h2 style="color: #333;">New Enrollment Request</h2>
                                <p style="color: #555;">A new enrollment request for the <span style= "color:blue; font-weight : 600;">${examName}</span> Exam is available.</p>
                                <p style="color: #555;">Please review and process it accordingly.</p>
                                <h3 style="color: #333;">Details:</h3>
                                <ul>
                                    <li><strong>User Name:</strong> ${userName}</li>
                                    <li><strong>Exam Name:</strong> ${examName}</li>
                                    <li><strong>Last Date:</strong> ${enddate}</li>
                                </ul>
                                <p style="text-align: center;">
                                    <a href="https://online-exam-portal-ymbm.onrender.com/home" style="display: inline-block; background-color: #007bff; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to HomePage</a>
                                </p>
                            </div>
                        </div>
                    `
                });
         return res.redirect("/dashboard/:id")

    } catch (error) {
        console.error("Error:", error);
        res.render("templates/internalerror.ejs")
    }
}

module.exports.examInstructions = async(req,res)=>{
    try {
        const {id} = req.params;
        const exam = await Exam.findById(id);

        res.render("student/instructions.ejs",{exam})
    }catch(error){
        console.error("Error:", error);
        res.render("templates/internalerror.ejs")   
    }
}

// function shuffleArray(array) {
//     for (let i = array.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [array[i], array[j]] = [array[j], array[i]];
//     }
//     return array;
// }

module.exports.getQuestionFromExamID = async(req,res)=>{
    try {
        const {id} = req.params;
        const exam = await Exam.findById(id).populate("questions");
        // exam.questions = shuffleArray(exam.questions);
        res.render("student/displayQues.ejs",{exam,currentQuestionIndex : 0});
    }catch(error){
        console.error("Error:", error);
        res.render("templates/internalerror.ejs")   
    }
}

module.exports.submitAns = async (req, res) => {
    try {
        const {id} = req.params;
        const Answers = await Exam.findById(id);

        const username = req.user.username;
        const email = req.user.email;
        const userid = req.user._id; 
        const examname = Answers.examName;
        const totalMarks = Answers.totalMarks;
        const passingMarks = Answers.passingMarks;
        
        let score = 0;
        let skipped = 0;
        let incorrect = 0;
        let totalQuestions = Answers.questions.length;

        // Arrays to store details for each question
        const selectedOptions = [];
        const actualQuestions = [];

       
        // Loop through each question ID in the array
        for (let i = 0; i < Answers.questions.length; i++) {
            // Find the corresponding question using the questionId
            const questionId = Answers.questions[i];
            const question = await questions.findById(questionId);

            // If the question is found, process its details
            if (question) {
                const selectedOption = req.body[`selectedOption${i}`];
                const questionId = req.body[`questionId${i}`];
                // Store details in arrays
                selectedOptions.push({
                    questionId,
                    selectedOption,
                    selectOpt : question.options[selectedOption],
                });
                actualQuestions.push({
                    questionId,
                    actualQuestion: question.question,
                    correctOption: question.correct,
                    option :  question.options[question.correct]
                });

                // Check if the selected option is correct
                if (selectedOption == question.correct) {
                    score++;
                }else if(selectedOption == undefined){
                    skipped++;
                }else if(selectedOption != question.correct){
                    incorrect++
                }
            }
        }
        if(score >= passingMarks) {
            vedrict = "Pass"
        }else {
            vedrict = "fail"
        }
        const Perfermance = new StudentPerformance({
            userid :userid,
            userId : username,
            Exam : examname,
            Score : score,
            totalMarks : totalMarks,
            passingMarks : passingMarks,
            vedrict : vedrict,
            examid : id
        })
        const performance = await Perfermance.save();
        const studentRecord = await user.findOne({_id: userid});
        studentRecord.records.push(performance._id);
        await studentRecord.save();
        const student = await StudentPerformance.findById(performance._id);
        const date = student.created_at.toLocaleDateString();
        const pfss = student.vedrict;
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD
            }
        });

        // Send email
        const info = await transporter.sendMail({
            from: process.env.MAIL_USER,
            to:  email,
            subject: `Your ${examname} Scorecard is Ready for Review!`,
            text: `Congratulations! Your exam scorecard is now available for review. 
                    Dive in to see your results and performance breakdown. 
                    Access your scorecard now to track your progress and plan your next steps. 
                    Best of luck on your academic journey!`,
            html: `
            <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                <div style="background-color: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                    <h2 style="color: #333;">Exam Scorecard</h2>
                    <h3 style="color: #333;">Exam Details:</h3>
                    <ul>
                        <li><strong>Exam Name:</strong> ${examname}</li>
                        <li><strong>Exam Date:</strong> ${date}</li>
                    </ul>
                    <h3 style="color: #333;">Student Details:</h3>
                    <ul>
                        <li><strong>Student Name:</strong> ${username}</li>
                    </ul>
                    <h3 style="color: #333;">Score:</h3>
                    <ul>
                        <li><strong>Total Marks:</strong> ${totalMarks}</li>
                        <li><strong>Passing Marks:</strong> ${passingMarks}</li>
                        <li><strong>Score:</strong> ${score}</li>
                        <li><strong>Verdict:</strong> ${vedrict}</li>
                    </ul>
                </div>
            </div>
        `
        });

        res.render("student/score.ejs",{totalQuestions,score,skipped,incorrect,Answers,username,date,userid,selectedOptions,actualQuestions,examname,pfss});
    }catch(error) {
        console.error("Error:", error);
        res.render("templates/internalerror.ejs")
    }
};

module.exports.records = async(req,res)=>{
    try {
        const record = await StudentPerformance.find();
        res.render("templates/records.ejs",{record});
    }catch(error) {
        console.error("Error:", error);
        res.render("templates/internalerror.ejs")
    }
}



module.exports.filterRecords = async (req, res) => {
    try {
        const { examName, filterDate } = req.body;

        // Add your filtering logic based on examName and filterDate
        const filteredRecords = await StudentPerformance.find({
            Exam: examName,
            created_at: { $gte: new Date(`${filterDate}T00:00:00.000Z`), $lte: new Date(`${filterDate}T23:59:59.999Z`) }
        });

        res.render("templates/records.ejs", { record: filteredRecords });
    } catch (error) {
        console.error("Error:", error);
        res.render("templates/internalerror.ejs")
    }
}

module.exports.dashboard = async(req,res)=>{
    try {
        const username = req.user.username;
        const email = req.user.email;
        const userid = req.user._id;
        const regnumber = req.user.regnumber;
        const userWithReports = await user.findById(userid).populate("records");
        const userWithEnrolledExams = await user.findById(userid).populate("enrolled");
         // Sort records by most recent first
         userWithReports.records.sort((a, b) => b.created_at - a.created_at);

        // Filter enrolled exams to exclude those for which reports exist
        const filteredEnrolledExams = userWithEnrolledExams.enrolled.filter(EnrollmentRequest => {
            return !userWithReports.records.some(StudentPerformance => StudentPerformance.examid.equals(EnrollmentRequest.examId));
        });
        res.render("student/dashboard.ejs",{
            username,
            email,
            userid,
            reports: userWithReports,
            regnumber,
            // enroll :userWithEnrolledExams
            enroll: { enrolled: filteredEnrolledExams }
        });
    }catch(error){
        console.error("Error:", error);
        res.render("templates/internalerror.ejs")
    }
}

// student Reviews 

module.exports.reviews = async(req,res)=>{
    try {
        const {id} = req.params;
        const {Review,rating} = req.body;
        const boy = await user.findById(id);
        const username = boy.username;
        const userId = boy._id
        const newReview = new Reviews ({
            user : userId,
            username : username,
            review : Review,
            rating : rating,
        });
        await newReview.save();
        res.redirect("/about")
    } catch (error) {
        console.error("Error:", error);
        res.render("templates/internalerror.ejs")
    }
}

module.exports.delRevview = async(req,res)=>{
    try {
        const {id} = req.params;
        await Reviews.findByIdAndDelete(id)
        res.redirect("/about")
    } catch (error) {
        console.error("Error:", error);
        res.render("templates/internalerror.ejs")
    }
}