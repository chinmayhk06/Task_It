import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiCheckCircle } from "react-icons/fi";

import Card from "../../components/common/Card";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import api from "../../services/api";
import { signInWithGoogle } from "../../services/firebaseAuthService";
import { invitationReturn, authLink } from "../../utils/authReturn";

function Login() {
  const navigate = useNavigate();
  const returnTo = invitationReturn();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setErrors({
      ...errors,
      [e.target.name]: "",
    });
    setSubmitError("");
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email: formData.email,
        password: formData.password,
      });

      // Save JWT Token
      localStorage.setItem("token", response.data.token);

      // Save User (optional)
      localStorage.setItem(
        "user",
        JSON.stringify(response.data.data)
      );

      navigate(returnTo || "/dashboard");
    } catch (error) {
      setSubmitError(
        error.response?.data?.message ||
          "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
        setLoading(true);
        setSubmitError("");

        const firebaseUser = await signInWithGoogle();
        const idToken = await firebaseUser.getIdToken();

        const response = await api.post("/auth/google", {
            idToken,
        });

        localStorage.setItem("token", response.data.token);
        localStorage.setItem(
            "user",
            JSON.stringify(response.data.data)
        );

        navigate(returnTo || "/dashboard");
    } catch (error) {
        setSubmitError(
            error.response?.data?.message ||
            error.message ||
            "Google sign-in failed."
        );
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--main-bg)] text-[var(--title-color)]">
      {/* LEFT PANEL */}
      <div className="hidden w-1/2 items-center justify-center border-r border-[var(--border-color)] bg-[var(--sidebar-bg)] px-20 lg:flex">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="rounded-md bg-[var(--accent)] p-3 text-[var(--accent-contrast)]">
              <FiCheckCircle size={28} />
            </div>

            <h1 className="text-4xl font-semibold text-[var(--title-color)]">
              Task It
            </h1>
          </div>

          <h2 className="text-5xl font-semibold leading-tight text-[var(--title-color)]">
            Welcome Back.
            <br />
            Let's get productive.
          </h2>

          <p className="mt-6 text-lg leading-8 text-[var(--subtitle-color)]">
            Continue managing your projects, collaborating with
            teammates, and tracking your progress - all from one
            place.
          </p>

          <div className="mt-12 border-l-2 border-[var(--title-color)] pl-6">
            <p className="italic text-[var(--subtitle-color)]">
              "Success is the sum of small efforts repeated every
              day."
            </p>

            <p className="mt-3 font-medium text-[var(--title-color)]">
              Task It
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}

      <div className="flex flex-1 items-center justify-center px-8">
        <Card>
          <h2 className="text-3xl font-semibold text-[var(--title-color)]">
            Sign In
          </h2>

          <p className="mt-2 text-[var(--subtitle-color)]">
            Welcome back! Please enter your details.
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={handleSubmit}
          >
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
            />

            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
            />

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-[var(--subtitle-color)] transition hover:text-[var(--title-color)]"
              >
                Forgot Password?
              </Link>
            </div>

            {submitError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
            </Button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border-color)]" />
              </div>

            <div className="relative flex justify-center text-sm">
              <span className="bg-[var(--main-bg)] px-3 text-[var(--subtitle-color)]">
              OR
              </span>
            </div>
            </div>

            <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full rounded-md border border-[var(--border-color)] px-4 py-2.5 font-medium text-[var(--title-color)] transition hover:bg-[var(--sidebar-bg)] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? "Signing In..." : "Continue with Google"}
            </button>
            
          </form>

          <p className="mt-8 text-center text-[var(--subtitle-color)]">
            Don't have an account?{" "}
            <Link
              to={authLink("/register", returnTo)}
              className="font-semibold text-[var(--title-color)] hover:underline"
            >
              Create one
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default Login;






