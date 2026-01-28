let currentUserProfile = null;

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  query,
  where,
  deleteDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvCAnjI58ns5dWgmcY_saq1w3W_Qe9I7Y",
  authDomain: "friendconnect-99a50.firebaseapp.com",
  projectId: "friendconnect-99a50",
  storageBucket: "friendconnect-99a50.appspot.com",
  messagingSenderId: "904196830848",
  appId: "1:904196830848:web:50c15121c2c04f1ea01865"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let sentRequests = new Set();
let friendsSet = new Set();

/* ✅ NOW everything exists */
async function loadIncomingRequests(user) {
  const requestsList = document.getElementById("requestsList");
  requestsList.innerHTML = "";

  const q = query(
    collection(db, "friendRequests"),
    where("to", "==", user.uid),
    where("status", "==", "pending")
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    requestsList.innerHTML = `<span style="color:var(--muted)">No requests yet</span>`;
    return;
  }

  for (const docSnap of snap.docs) {
    const req = docSnap.data();
    const senderSnap = await getDoc(doc(db, "users", req.from));
    if (!senderSnap.exists()) continue;

    const sender = senderSnap.data();
    const card = document.createElement("div");
    card.className = "request-card";

    card.innerHTML = `
      <span><strong>${sender.name}</strong> wants to be your friend</span>
      <div class="request-actions">
        <button class="accept-btn" onclick="acceptRequest('${docSnap.id}', '${req.from}')">Accept</button>
        <button class="decline-btn" onclick="declineRequest('${docSnap.id}')">Decline</button>
      </div>
    `;

    requestsList.appendChild(card);
  }
}

async function loadSentRequests(user) {
  sentRequests.clear();

  const q = query(
    collection(db, "friendRequests"),
    where("from", "==", user.uid),
    where("status", "==", "pending")
  );

  const snap = await getDocs(q);
  snap.forEach((docSnap) => {
    const req = docSnap.data();
    sentRequests.add(req.to);
  });
}

const authModal = document.getElementById("authModal");
const userNav = document.getElementById("userNav");
const profilesGrid = document.getElementById("profilesGrid");
const bioInput = document.getElementById("bio");
const bioCounter = document.getElementById("bioCounter");

bioInput.addEventListener("input", () => {
  const length = bioInput.value.length;
  bioCounter.textContent = `${length} / 150`;
  bioCounter.style.color = length > 150 ? "var(--red)" : "var(--muted)";
});

authModal.addEventListener("click", (e) => {
  if (e.target === authModal) authModal.style.display = "none";
});

function renderProfile(profile, isYou = false) {
  if (!profile?.name) return;

  const bioText = profile.bio || "";
  const isLongBio = bioText.length > 90;
  const card = document.createElement("div");
  card.className = "profile";

  card.innerHTML = `
    <div class="avatar">${profile.name[0].toUpperCase()}</div>
    <h3 style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      <span>${profile.name}, ${profile.age ?? "?"}</span>
      ${profile.verified ? `
        <span class="verified-badge" title="Verified account">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15-4-4 1.41-1.41L11 13.17l4.59-4.59L17 10l-6 7z"/></svg>
        </span>` : ""}
      ${profile.plan && profile.plan !== "free" ? `
        <span class="tag" style="border-color:#3b82f6;color:#3b82f6;font-weight:600;">
          ${profile.plan === "elite" ? "Elite" : profile.plan === "platinum" ? "Platinum" : "Regalium+"}
        </span>` : ""}
    </h3>

    <span class="bio">${bioText || "No bio yet"}</span>
    ${isLongBio ? `<span class="read-more">Read more</span>` : ""}

    <div class="tags">
      ${(profile.interests || []).map(i => `<div class="tag">${i}</div>`).join("")}
      ${isYou ? `<div class="tag">You</div>` : ""}
    </div>

    ${!isYou ? (
      friendsSet.has(profile.uid)
        ? `<button class="add-friend" disabled>Friends ✓</button>`
        : sentRequests.has(profile.uid)
          ? `<button class="add-friend sent" disabled>Request Sent</button>`
          : currentUserProfile?.friendRequestsEnabled === false
            ? `<button class="add-friend" disabled style="opacity:.6">Requests Disabled</button>`
            : `<button class="add-friend" onclick="sendFriendRequest('${profile.uid}')">Add Friend</button>`
    ) : ""}
  `;

  profilesGrid.appendChild(card);
}

window.openAuthIfNeeded = () => authModal.style.display = "flex";
window.openDealFromBanner = () => document.getElementById("dealModal").style.display = "flex";
window.closeDeal = () => document.getElementById("dealModal").style.display = "none";

window.saveProfile = async () => {
  const name = document.getElementById("name").value.trim();
  const age = Number(document.getElementById("age").value);
  const bio = document.getElementById("bio").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) return alert("Email and password required");
  if (!name || !age || !bio) return alert("Please fill out all profile fields");
  if (!Number.isInteger(age) || age < 13 || age > 120) return alert("Age must be a number between 13 and 120");
  if (bio.length > 150) return alert("Bio must be 150 characters or less");

  try {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        cred = await signInWithEmailAndPassword(auth, email, password);
      } else throw err;
    }

    const userRef = doc(db, "users", cred.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        name,
        age,
        bio,
        plan: "free",
        verified: false,
        friendRequestsEnabled: true,
        createdAt: Date.now()
      });
    }

    authModal.style.display = "none";
  } catch (err) {
    alert(err.message);
  }
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    userNav.textContent = "Sign in";
    profilesGrid.innerHTML = "";
    authModal.style.display = "flex";
    return;
  }

  authModal.style.display = "none";

  const yourSnap = await getDoc(doc(db, "users", user.uid));
  if (!yourSnap.exists()) return;

  currentUserProfile = yourSnap.data();
  userNav.textContent = currentUserProfile.name;

  await loadFriends();
  await loadSentRequests(user);
  await loadIncomingRequests(user);
  await refreshProfiles();

  if (currentUserProfile.friendRequestsEnabled === false) {
    showAdminNotice(
      "Friend requests disabled",
      "An admin has temporarily disabled your ability to send friend requests."
    );
  }
});

window.sendFriendRequest = async (targetUid) => {
  const user = auth.currentUser;
  if (!user) return alert("You must be logged in");
  if (sentRequests.has(targetUid) || friendsSet.has(targetUid)) return;

  const requestId = `${user.uid}_${targetUid}`;
  const requestRef = doc(db, "friendRequests", requestId);

  const snap = await getDoc(requestRef);
  if (snap.exists()) {
    sentRequests.add(targetUid);
    await refreshProfiles();
    return;
  }

  await setDoc(requestRef, {
    from: user.uid,
    to: targetUid,
    status: "pending",
    createdAt: Date.now()
  });

  sentRequests.add(targetUid);
  await refreshProfiles();
};

window.unfriend = async (friendUid) => {
  const user = auth.currentUser;
  const batch = writeBatch(db);

  batch.delete(doc(db, "friends", `${user.uid}_${friendUid}`));
  batch.delete(doc(db, "friends", `${friendUid}_${user.uid}`));

  await batch.commit();
  friendsSet.delete(friendUid);

  await loadFriends();
  await refreshProfiles();
};

window.declineRequest = async (requestId) => {
  await deleteDoc(doc(db, "friendRequests", requestId));
  await loadIncomingRequests(auth.currentUser);
  await refreshProfiles();
};

window.acceptRequest = async (requestId, fromUid) => {
  const user = auth.currentUser;
  const batch = writeBatch(db);

  batch.set(doc(db, "friends", `${user.uid}_${fromUid}`), {
    owner: user.uid,
    friend: fromUid,
    createdAt: Date.now()
  });

  batch.set(doc(db, "friends", `${fromUid}_${user.uid}`), {
    owner: fromUid,
    friend: user.uid,
    createdAt: Date.now()
  });

  batch.delete(doc(db, "friendRequests", requestId));
  await batch.commit();

  friendsSet.add(fromUid);
  sentRequests.delete(fromUid);

  await loadIncomingRequests(user);
  await loadFriends();
  await refreshProfiles();
};

window.openFriends = async () => {
  document.getElementById("friendsModal").style.display = "flex";
  await loadFriends();
};

window.closeFriends = () => {
  document.getElementById("friendsModal").style.display = "none";
};

async function loadFriends() {
  const user = auth.currentUser;
  if (!user) return;

  friendsSet.clear();
  const friendsList = document.getElementById("friendsList");
  if (!friendsList) return;
  friendsList.innerHTML = "";

  const q = query(collection(db, "friends"), where("owner", "==", user.uid));
  const snap = await getDocs(q);

  if (snap.empty) {
    friendsList.innerHTML = `<span style="color:var(--muted)">No friends yet</span>`;
    return;
  }

  for (const docSnap of snap.docs) {
    const friendUid = docSnap.data().friend;
    friendsSet.add(friendUid);

    const friendSnap = await getDoc(doc(db, "users", friendUid));
    if (!friendSnap.exists()) continue;

    const friend = friendSnap.data();
    const div = document.createElement("div");
    div.style.padding = "10px 0";
    div.style.borderBottom = "1px solid var(--border)";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>${friend.name}</strong>
        <button onclick="unfriend('${friendUid}')">Unfriend</button>
      </div>
    `;
    friendsList.appendChild(div);
  }
}

window.goToChat = () => window.location.href = "chat.html";

function showAdminNotice(title, message) {
  if (document.getElementById("adminNotice")) return;
  const notice = document.createElement("div");
  notice.id = "adminNotice";
  notice.innerHTML = `<strong>${title}</strong><br>${message}`;
  document.body.prepend(notice);
}

async function refreshProfiles() {
  const user = auth.currentUser;
  if (!user) return;

  profilesGrid.innerHTML = "";

  const yourSnap = await getDoc(doc(db, "users", user.uid));
  if (yourSnap.exists()) {
    renderProfile({ ...yourSnap.data(), uid: user.uid }, true);
  }

  const allUsersSnap = await getDocs(collection(db, "users"));
  const others = [];

  allUsersSnap.forEach((docSnap) => {
    if (docSnap.id !== user.uid) {
      others.push({ ...docSnap.data(), uid: docSnap.id });
    }
  });

  const myInterests = new Set(currentUserProfile?.interests || []);
  others.sort((a, b) =>
    (b.interests || []).filter(i => myInterests.has(i)).length -
    (a.interests || []).filter(i => myInterests.has(i)).length
  );

  others.forEach(profile => renderProfile(profile, false));
}

const ALL_INTERESTS = [
  "Gaming","Music","Art","Sports","Coding",
  "Movies","Anime","Reading","Fitness","Travel"
];

let selectedInterests = new Set();

window.openInterests = () => {
  if (!currentUserProfile) return alert("Profile still loading");
  document.getElementById("interestsModal").style.display = "flex";
  renderInterestChips();
};

window.closeInterests = () => {
  document.getElementById("interestsModal").style.display = "none";
};

function renderInterestChips() {
  const container = document.getElementById("interestChips");
  container.innerHTML = "";
  selectedInterests = new Set(currentUserProfile?.interests || []);

  ALL_INTERESTS.forEach((interest) => {
    const chip = document.createElement("div");
    chip.className = "interest-chip";
    chip.textContent = interest;
    if (selectedInterests.has(interest)) chip.classList.add("selected");

    chip.onclick = () => {
      selectedInterests.has(interest)
        ? selectedInterests.delete(interest)
        : selectedInterests.add(interest);
      chip.classList.toggle("selected");
    };

    container.appendChild(chip);
  });
}

window.saveInterests = async () => {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  await setDoc(
    doc(db, "users", user.uid),
    { interests: Array.from(selectedInterests) },
    { merge: true }
  );

  const snap = await getDoc(doc(db, "users", user.uid));
  currentUserProfile = snap.data();

  closeInterests();
  await refreshProfiles();
};
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const announcementBanner = document.getElementById("globalAnnouncement");
const announcementRef = doc(db, "announcements", "global");

onSnapshot(announcementRef, (docSnap) => {
  if (!docSnap.exists()) {
    announcementBanner.classList.add("hidden");
    return;
  }

  const data = docSnap.data();
  if (data.active && data.message) {
    announcementBanner.textContent = data.message;
    announcementBanner.classList.remove("hidden");
  } else {
    announcementBanner.classList.add("hidden");
  }
});

// Optional: allow users to click to dismiss
announcementBanner.onclick = () => announcementBanner.classList.add("hidden");
