from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


# ============================================================
# PUBLIC REPAIR STATUS SYNC
# Enables the customer-facing /status/:ticket_no page to see a
# shared view of the repair regardless of which device scanned
# the QR. Admins push a snapshot on every mutation; public page
# reads it back. This co-exists with the localStorage mock: the
# frontend still uses localStorage as the primary admin store,
# and simply mirrors public-facing fields here.
# ============================================================

class PublicRepairSnapshot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_no: str = ""
    status: str = "pending"
    device_brand: str = ""
    device_model: str = ""
    serial_no: Optional[str] = None
    complaint: str = ""
    customer_name: str = ""
    customer_phone: str = ""
    technician_name: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    picked_up_at: Optional[str] = None
    total: float = 0
    paid: float = 0
    balance: float = 0
    rating: Optional[int] = None
    review: Optional[str] = None
    rated_at: Optional[str] = None
    admin_reply: Optional[str] = None
    admin_reply_by_name: Optional[str] = None
    admin_reply_at: Optional[str] = None
    shop: Optional[dict] = None
    updated_at: Optional[str] = None


@api_router.get("/public-sync/reviews")
async def list_public_reviews():
    """
    Return every public_repairs snapshot that has a rating, so the admin
    'Ulasan Pelanggan' page can display reviews submitted from any device
    (including a customer's phone that only ever hit the public endpoint).
    Must be declared BEFORE /public-sync/{ticket_no} so FastAPI doesn't
    treat "reviews" as a ticket path parameter.
    """
    cursor = db.public_repairs.find(
        {"rating": {"$gte": 1}},
        {"_id": 0},
    ).sort("rated_at", -1)
    reviews = await cursor.to_list(500)
    return {"reviews": reviews}


@api_router.post("/public-sync/{ticket_no}")
async def sync_public_repair(ticket_no: str, payload: PublicRepairSnapshot, only_if_new: bool = False):
    doc = payload.model_dump()
    doc["ticket_no"] = ticket_no
    doc["synced_at"] = datetime.now(timezone.utc).isoformat()
    if only_if_new:
        # Seed path: only insert when the ticket has never been synced.
        # Prevents a client that re-seeds its localStorage from overwriting
        # admin edits already stored on the server.
        result = await db.public_repairs.update_one(
            {"ticket_no": ticket_no},
            {"$setOnInsert": doc},
            upsert=True,
        )
        return {"success": True, "inserted": bool(result.upserted_id), "synced_at": doc["synced_at"]}
    await db.public_repairs.update_one(
        {"ticket_no": ticket_no},
        {"$set": doc},
        upsert=True,
    )
    return {"success": True, "synced_at": doc["synced_at"]}


@api_router.get("/public-sync/{ticket_no}")
async def get_public_repair(ticket_no: str):
    doc = await db.public_repairs.find_one({"ticket_no": ticket_no}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="not_found")
    return doc


class PublicRatingIn(BaseModel):
    rating: int
    review: Optional[str] = ""


@api_router.post("/public-sync/{ticket_no}/rating")
async def submit_public_rating(ticket_no: str, payload: PublicRatingIn):
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="rating_out_of_range")
    review = (payload.review or "").strip()
    if len(review) > 500:
        raise HTTPException(status_code=400, detail="review_too_long")

    existing = await db.public_repairs.find_one({"ticket_no": ticket_no})
    if not existing:
        raise HTTPException(status_code=404, detail="not_found")
    if existing.get("status") != "picked_up":
        raise HTTPException(status_code=400, detail="status_not_picked_up")
    if existing.get("rating"):
        raise HTTPException(status_code=409, detail="already_rated")

    now = datetime.now(timezone.utc).isoformat()
    await db.public_repairs.update_one(
        {"ticket_no": ticket_no},
        {"$set": {
            "rating": payload.rating,
            "review": review,
            "rated_at": now,
            "updated_at": now,
        }},
    )
    return {"success": True, "rating": payload.rating, "review": review, "rated_at": now}


class AdminReplyIn(BaseModel):
    reply: Optional[str] = ""
    admin_reply_by_name: Optional[str] = None


@api_router.post("/public-sync/{ticket_no}/reply")
async def submit_admin_reply(ticket_no: str, payload: AdminReplyIn):
    """
    Save an admin reply for a review. Deleting the reply is done by sending
    an empty string. Used to keep server in sync when the admin acts on a
    review that only exists server-side (customer rated cross-device).
    """
    text = (payload.reply or "").strip()
    if len(text) > 500:
        raise HTTPException(status_code=400, detail="reply_too_long")

    existing = await db.public_repairs.find_one({"ticket_no": ticket_no})
    if not existing:
        raise HTTPException(status_code=404, detail="not_found")
    if not existing.get("rating"):
        raise HTTPException(status_code=400, detail="review_missing")

    now = datetime.now(timezone.utc).isoformat()
    if text:
        await db.public_repairs.update_one(
            {"ticket_no": ticket_no},
            {"$set": {
                "admin_reply": text,
                "admin_reply_by_name": payload.admin_reply_by_name or "Admin",
                "admin_reply_at": now,
                "updated_at": now,
            }},
        )
        return {"success": True, "admin_reply": text, "admin_reply_at": now}
    else:
        await db.public_repairs.update_one(
            {"ticket_no": ticket_no},
            {"$unset": {"admin_reply": "", "admin_reply_by_name": "", "admin_reply_at": ""},
             "$set": {"updated_at": now}},
        )
        return {"success": True, "deleted": True}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()