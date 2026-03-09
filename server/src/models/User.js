import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

/**
 * User Model for Authentication & RBAC
 * 
 * Roles:
 * - superadmin: System-wide control across all yards
 * - admin: Full system access for a single yard
 * - gatekeeper: RFID Sessions page only
 * 
 * Future roles:
 * - clientadmin: Client-level access
 * - locationadmin: Location-specific access
 */
const ROLES = ['superadmin', 'admin', 'gatekeeper'];
const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
            index: true,
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false, // Never return password in queries by default
        },
        role: {
            type: String,
            enum: {
                values: ROLES,
                message: 'Role must be one of: ' + ROLES.join(', '),
            },
            default: 'gatekeeper',
            index: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: {
            type: Date,
        },
    },
    {
        timestamps: true, // Adds createdAt, updatedAt
    }
);

/**
 * Pre-save hook: Hash password before saving
 */
userSchema.pre('save', async function (next) {
    // Only hash if password is modified (or new)
    if (!this.isModified('password')) {
        return next();
    }
    
    try {
        this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
        next();
    } catch (error) {
        next(error);
    }
});

/**
 * Compare password with hashed password
 * @param {string} candidatePassword - Plain text password to check
 * @returns {Promise<boolean>} - True if password matches
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Return user object without sensitive fields
 */
userSchema.methods.toSafeObject = function () {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        isActive: this.isActive,
        createdAt: this.createdAt,
        lastLogin: this.lastLogin,
    };
};

// Static: Available roles for validation
userSchema.statics.ROLES = ROLES;

const User = mongoose.model('User', userSchema);

export default User;
