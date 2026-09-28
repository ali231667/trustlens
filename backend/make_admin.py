"""
Grants or revokes admin access from the command line.

    cd backend
    .\\venv\\Scripts\\python.exe make_admin.py you@example.com            # make admin
    .\\venv\\Scripts\\python.exe make_admin.py --revoke you@example.com   # remove admin
    .\\venv\\Scripts\\python.exe make_admin.py --list                     # who is admin

WHY THIS IS A SCRIPT AND NOT A BUTTON
-------------------------------------
There is deliberately no web page or API call that turns an account into an
admin unless you are already an admin. If there were, anyone who found it
could take over the platform. Running this needs access to the server's own
machine and database, which is the same trust boundary real products use to
create their first administrator. After that, admins can grant admin access
to others from the admin panel, and every grant is recorded in the audit log.
"""
import json
import sys

from database import init_db, SessionLocal, User, AuditLog


def _find(db, email):
    user = db.query(User).filter(User.email == email.strip().lower()).first()
    if not user:
        sys.exit(f"No account with the email {email!r}. Sign up on the website first.")
    return user


def main(argv):
    init_db()
    db = SessionLocal()
    try:
        if not argv or argv[0] in ("-h", "--help"):
            print(__doc__)
            return

        if argv[0] == "--list":
            admins = db.query(User).filter(User.role == "admin").all()
            if not admins:
                print("No admins yet.")
            for u in admins:
                print(f"  {u.email}  ({u.full_name})")
            return

        revoke = argv[0] == "--revoke"
        email = argv[1] if revoke else argv[0]
        if not email:
            sys.exit("Give an email address.")
        user = _find(db, email)

        if revoke:
            if user.role != "admin":
                sys.exit(f"{user.email} is not an admin.")
            user.role = "user"
            action_to = "user"
        else:
            if not user.email_verified:
                sys.exit(f"{user.email} hasn't verified its email yet. Finish signing up first.")
            if user.is_active is False:
                sys.exit(f"{user.email} is suspended.")
            if user.role == "admin":
                print(f"{user.email} is already an admin.")
                return
            user.role = "admin"
            action_to = "admin"

        # admin_id is empty: this change came from the server itself, not
        # from someone logged into the panel. The panel shows it as
        # "Command line".
        db.add(AuditLog(
            admin_id=None,
            action="user.role_change",
            target_type="user",
            target_id=user.id,
            details=json.dumps({"email": user.email, "to_role": action_to, "via": "make_admin.py"}),
        ))
        db.commit()
        print(f"Done. {user.email} is now {'an admin' if action_to == 'admin' else 'a regular user'}.")
        print("Log out and back in on the website so the Admin link appears.")
    finally:
        db.close()


if __name__ == "__main__":
    main(sys.argv[1:])
