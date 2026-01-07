/**
 * AI News Service
 * Fetches AI/EdTech news from RSS feeds and summarizes them in Hebrew using Claude
 */

import { db } from '../firebase';
import {
    collection,
    doc,
    getDocs,
    setDoc,
    query,
    orderBy,
    limit,
    Timestamp
} from 'firebase/firestore';

// RSS Feed sources for AI in Education news
const RSS_FEEDS = [
    'https://openai.com/blog/rss.xml',
    'https://blog.google/technology/ai/rss/',
    'https://www.edsurge.com/feeds/articles',
    'https://venturebeat.com/category/ai/feed/',
];

export interface AINewsItem {
    id: string;
    originalTitle: string;
    originalSummary: string;
    hebrewTitle: string;
    hebrewSummary: string;
    sourceUrl: string;
    sourceName: string;
    publishedAt: Timestamp;
    fetchedAt: Timestamp;
    imageUrl?: string;
    relevanceScore: number; // 1-10, how relevant to teachers
}

// Keywords that indicate relevance to education
const EDUCATION_KEYWORDS = [
    'education', 'learning', 'teaching', 'school', 'student', 'teacher',
    'classroom', 'curriculum', 'training', 'course', 'lesson',
    'academic', 'university', 'edtech', 'e-learning', 'tutoring'
];

/**
 * Calculate relevance score based on keywords
 */
function calculateRelevanceScore(title: string, summary: string): number {
    const text = `${title} ${summary}`.toLowerCase();
    let score = 5; // Base score

    for (const keyword of EDUCATION_KEYWORDS) {
        if (text.includes(keyword)) {
            score += 1;
        }
    }

    return Math.min(score, 10);
}

/**
 * Parse RSS feed and extract articles
 */
async function parseRSSFeed(feedUrl: string): Promise<Array<{
    title: string;
    summary: string;
    link: string;
    pubDate: string;
    sourceName: string;
}>> {
    try {
        // Use a CORS proxy for client-side fetching
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (!data.contents) {
            console.warn(`No contents from RSS feed: ${feedUrl}`);
            return [];
        }

        const parser = new DOMParser();
        const xml = parser.parseFromString(data.contents, 'text/xml');

        const items = xml.querySelectorAll('item');
        const articles: Array<{
            title: string;
            summary: string;
            link: string;
            pubDate: string;
            sourceName: string;
        }> = [];

        // Get source name from feed
        const channelTitle = xml.querySelector('channel > title')?.textContent ||
                            new URL(feedUrl).hostname;

        items.forEach((item, index) => {
            if (index >= 5) return; // Limit to 5 per feed

            const title = item.querySelector('title')?.textContent || '';
            const description = item.querySelector('description')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';

            // Clean HTML from description
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = description;
            const cleanSummary = tempDiv.textContent || tempDiv.innerText || '';

            articles.push({
                title,
                summary: cleanSummary.substring(0, 500),
                link,
                pubDate,
                sourceName: channelTitle
            });
        });

        return articles;
    } catch (error) {
        console.error(`Error fetching RSS feed ${feedUrl}:`, error);
        return [];
    }
}

/**
 * Summarize and translate to Hebrew using Claude API
 * This should be called from a Cloud Function for security
 */
export async function summarizeWithClaude(
    title: string,
    summary: string,
    apiKey: string
): Promise<{ hebrewTitle: string; hebrewSummary: string }> {
    const prompt = `אתה עוזר שמתרגם ומסכם חדשות טכנולוגיה למורים ישראליים.

כתבה באנגלית:
כותרת: ${title}
תקציר: ${summary}

אנא:
1. תרגם את הכותרת לעברית בצורה תמציתית וברורה
2. כתוב סיכום של 2-3 משפטים בעברית, המתמקד בהשפעה על מורים ובית הספר

החזר את התשובה בפורמט JSON:
{
  "hebrewTitle": "הכותרת בעברית",
  "hebrewSummary": "הסיכום בעברית"
}`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 500,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        const data = await response.json();
        const content = data.content?.[0]?.text || '';

        // Parse JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return {
            hebrewTitle: title,
            hebrewSummary: summary
        };
    } catch (error) {
        console.error('Error calling Claude API:', error);
        return {
            hebrewTitle: title,
            hebrewSummary: summary
        };
    }
}

/**
 * Fetch news from Firestore cache
 */
export async function getAINews(limitCount: number = 5): Promise<AINewsItem[]> {
    try {
        const newsRef = collection(db, 'aiNews');
        const q = query(
            newsRef,
            orderBy('publishedAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        const news: AINewsItem[] = [];

        snapshot.forEach(doc => {
            news.push({ id: doc.id, ...doc.data() } as AINewsItem);
        });

        return news;
    } catch (error) {
        console.error('Error fetching AI news from Firestore:', error);
        return [];
    }
}

/**
 * Save news item to Firestore
 */
export async function saveNewsItem(item: Omit<AINewsItem, 'id'>): Promise<string> {
    const newsRef = collection(db, 'aiNews');
    const docId = `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await setDoc(doc(newsRef, docId), item);

    return docId;
}

/**
 * Fetch fresh news from RSS feeds (for Cloud Function use)
 * Returns raw articles without Hebrew translation
 */
export async function fetchFreshNews(): Promise<Array<{
    title: string;
    summary: string;
    link: string;
    pubDate: string;
    sourceName: string;
    relevanceScore: number;
}>> {
    const allArticles: Array<{
        title: string;
        summary: string;
        link: string;
        pubDate: string;
        sourceName: string;
        relevanceScore: number;
    }> = [];

    for (const feedUrl of RSS_FEEDS) {
        const articles = await parseRSSFeed(feedUrl);

        for (const article of articles) {
            const relevanceScore = calculateRelevanceScore(article.title, article.summary);

            // Only include articles with relevance score >= 5
            if (relevanceScore >= 5) {
                allArticles.push({
                    ...article,
                    relevanceScore
                });
            }
        }
    }

    // Sort by relevance and return top 10
    return allArticles
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10);
}

