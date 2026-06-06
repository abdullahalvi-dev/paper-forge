/*
 * Roman Urdu comments:
 * Ye controller teacher dashboard ka data provide karta hai.
 * Generated papers, resources, question-bank stats aur teacher activity summary yahan se milti hai.
 */
const Paper = require('../models/Paper');

const teacherStats = async (req, res, next) => {
  try {
    const papers = await Paper.find({ teacherId: req.user._id }).sort({ createdAt: -1 });
    const aiGeneratedPapers = papers.filter((paper) => paper.generatedByAI).length;
    const downloads = papers.reduce(
      (sum, paper) => sum + Number(paper.downloads?.pdf || 0) + Number(paper.downloads?.word || 0),
      0
    );

    res.json({
      stats: {
        totalPapers: papers.length,
        aiGeneratedPapers,
        downloads,
        activity: papers.slice(0, 5)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  teacherStats
};
