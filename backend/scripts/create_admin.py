from argparse import ArgumentParser
from getpass import getpass

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User


def main() -> None:
    parser = ArgumentParser(description="Create or update the Coffee Gosen administrator.")
    parser.add_argument("--email", required=True, help="Administrator email used for login")
    parser.add_argument("--name", required=True, help="Administrator full name")
    args = parser.parse_args()

    password = getpass("Admin password (minimum 8 characters): ")
    confirmation = getpass("Repeat admin password: ")
    if len(password) < 8:
        raise SystemExit("The administrator password must contain at least 8 characters.")
    if password != confirmation:
        raise SystemExit("The passwords do not match.")

    with SessionLocal() as database:
        user = database.scalar(select(User).where(User.email == args.email.strip().lower()))
        if user is None:
            user = User(
                full_name=args.name.strip(),
                email=args.email.strip().lower(),
                password_hash=hash_password(password),
                role="ADMIN",
                is_active=True,
            )
            database.add(user)
            action = "created"
        else:
            user.full_name = args.name.strip()
            user.password_hash = hash_password(password)
            user.role = "ADMIN"
            user.is_active = True
            action = "updated"
        database.commit()
        print(f"Administrator {action}: {user.email}")


if __name__ == "__main__":
    main()
