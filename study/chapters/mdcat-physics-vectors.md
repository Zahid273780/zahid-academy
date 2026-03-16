# Vectors

## What is a Vector?

A **vector** is a physical quantity that has both **magnitude** (size) and **direction**.

Examples of vectors: displacement, velocity, force, acceleration.

A **scalar** only has magnitude — like temperature, mass, or speed.

---

## Representation of a Vector

A vector $\vec{A}$ is written with an arrow on top. Its magnitude is written as $|\vec{A}|$ or simply $A$.

On a graph, a vector is drawn as an arrow pointing in its direction.

---

## Addition of Vectors

### Head-to-Tail Rule
Place the tail of the second vector at the head of the first. The resultant goes from the tail of the first to the head of the last.

### Parallelogram Law
If two vectors act at the same point, the resultant is the diagonal of the parallelogram formed by those two vectors.

$$\vec{R} = \vec{A} + \vec{B}$$

The magnitude of the resultant:

$$R = \sqrt{A^2 + B^2 + 2AB\cos\theta}$$

where $\theta$ is the angle between $\vec{A}$ and $\vec{B}$.

---

## Components of a Vector

Any vector can be split into two perpendicular components:

$$A_x = A\cos\theta \qquad A_y = A\sin\theta$$

And the magnitude can be recovered:

$$A = \sqrt{A_x^2 + A_y^2}$$

The direction angle:

$$\theta = \tan^{-1}\left(\frac{A_y}{A_x}\right)$$

---

## Dot Product (Scalar Product)

The dot product of two vectors gives a **scalar**:

$$\vec{A} \cdot \vec{B} = AB\cos\theta$$

Key properties:
- $\hat{i} \cdot \hat{i} = 1$, $\hat{j} \cdot \hat{j} = 1$, $\hat{k} \cdot \hat{k} = 1$
- $\hat{i} \cdot \hat{j} = 0$ (perpendicular vectors have zero dot product)

**Work** is the dot product of force and displacement:

$$W = \vec{F} \cdot \vec{d} = Fd\cos\theta$$

---

## Cross Product (Vector Product)

The cross product of two vectors gives a **vector** perpendicular to both:

$$|\vec{A} \times \vec{B}| = AB\sin\theta$$

Key properties:
- $\hat{i} \times \hat{j} = \hat{k}$
- $\hat{j} \times \hat{k} = \hat{i}$
- $\hat{k} \times \hat{i} = \hat{j}$
- $\vec{A} \times \vec{A} = 0$ (cross product of a vector with itself is zero)

**Torque** is the cross product of position and force:

$$\vec{\tau} = \vec{r} \times \vec{F}$$

---

## Quick Summary Table

| Quantity | Type | Formula |
|---|---|---|
| Dot Product | Scalar | $AB\cos\theta$ |
| Cross Product | Vector | $AB\sin\theta$ |
| Resultant | Vector | $\sqrt{A^2+B^2+2AB\cos\theta}$ |
| Work | Scalar | $Fd\cos\theta$ |
| Torque | Vector | $rF\sin\theta$ |

---

## Important MCQ Tips

- If two vectors are **parallel**, $\theta = 0°$, so $\sin\theta = 0$ and cross product = **zero**
- If two vectors are **perpendicular**, $\theta = 90°$, so $\cos\theta = 0$ and dot product = **zero**
- A unit vector has magnitude exactly **1**
- The negative of a vector has the **same magnitude** but **opposite direction**
