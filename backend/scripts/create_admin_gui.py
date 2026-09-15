import tkinter as tk
from tkinter import messagebox

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User


ADMIN_EMAIL = "gosenlugardepasto@gmail.com"
ADMIN_NAME = "Administrador Coffee Gosen"


def save_admin() -> None:
    password = password_input.get()
    confirmation = confirmation_input.get()
    if len(password) < 8:
        messagebox.showerror("Contraseña inválida", "La contraseña debe tener mínimo 8 caracteres.")
        return
    if password != confirmation:
        messagebox.showerror("No coincide", "Las contraseñas no coinciden.")
        return
    try:
        with SessionLocal() as database:
            user = database.scalar(select(User).where(User.email == ADMIN_EMAIL))
            if user is None:
                user = User(full_name=ADMIN_NAME, email=ADMIN_EMAIL, role="ADMIN", is_active=True, password_hash=hash_password(password))
                database.add(user)
                action = "creada"
            else:
                user.full_name = ADMIN_NAME
                user.role = "ADMIN"
                user.is_active = True
                user.password_hash = hash_password(password)
                action = "actualizada"
            database.commit()
        messagebox.showinfo("Configuración completa", f"La cuenta admin fue {action}:\n{ADMIN_EMAIL}")
        window.destroy()
    except Exception as error:
        messagebox.showerror("No fue posible guardar", str(error))


window = tk.Tk()
window.title("Configurar administrador Coffee Gosen")
window.resizable(False, False)
window.geometry("440x250")
frame = tk.Frame(window, padx=24, pady=20)
frame.pack(fill="both", expand=True)
tk.Label(frame, text="Configurar cuenta administrador", font=("Segoe UI", 13, "bold")).pack(anchor="w")
tk.Label(frame, text=f"Correo: {ADMIN_EMAIL}", pady=10).pack(anchor="w")
tk.Label(frame, text="Contraseña (mínimo 8 caracteres)").pack(anchor="w")
password_input = tk.Entry(frame, show="*", width=42)
password_input.pack(fill="x", pady=(4, 10))
tk.Label(frame, text="Repetir contraseña").pack(anchor="w")
confirmation_input = tk.Entry(frame, show="*", width=42)
confirmation_input.pack(fill="x", pady=(4, 14))
tk.Button(frame, text="Guardar cuenta admin", command=save_admin).pack(anchor="e")
password_input.focus_set()
window.mainloop()
